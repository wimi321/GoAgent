import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { getEventListeners } from 'node:events'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import ts from 'typescript'

async function importProviderForTest() {
  const root = await mkdtemp(join(tmpdir(), 'goagent-provider-test-'))
  const servicesDir = join(root, 'src/main/services')
  const providerDir = join(servicesDir, 'llm')
  await mkdir(providerDir, { recursive: true })

  const compilerOptions = {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    verbatimModuleSyntax: false
  }
  const llmResponseSource = await readFile(new URL('../src/main/services/llmResponse.ts', import.meta.url), 'utf8')
  const providerSource = (await readFile(new URL('../src/main/services/llm/openaiCompatibleProvider.ts', import.meta.url), 'utf8'))
    .replace("from '../llmResponse'", "from '../llmResponse.js'")

  await writeFile(
    join(servicesDir, 'llmResponse.js'),
    ts.transpileModule(llmResponseSource, { compilerOptions }).outputText,
    'utf8'
  )
  await writeFile(
    join(providerDir, 'openaiCompatibleProvider.js'),
    ts.transpileModule(providerSource, { compilerOptions }).outputText,
    'utf8'
  )

  const moduleUrl = pathToFileURL(join(providerDir, 'openaiCompatibleProvider.js')).href
  const provider = await import(`${moduleUrl}?t=${Date.now()}`)
  return {
    postOpenAICompatibleChat: provider.postOpenAICompatibleChat,
    streamOpenAICompatibleChat: provider.streamOpenAICompatibleChat,
    postOpenAICompatibleToolTurn: provider.postOpenAICompatibleToolTurn,
    streamOpenAICompatibleToolTurn: provider.streamOpenAICompatibleToolTurn,
    isLlmSetupConfigurationError: provider.isLlmSetupConfigurationError,
    probeOpenAICompatibleProvider: provider.probeOpenAICompatibleProvider,
    fetchWithTimeout: provider.fetchWithTimeout,
    parseRetryAfter: provider.parseRetryAfter,
    cleanup: () => rm(root, { recursive: true, force: true })
  }
}

async function withMockChatServer(handler, run) {
  const server = createServer((request, response) => {
    let raw = ''
    request.setEncoding('utf8')
    request.on('data', (chunk) => {
      raw += chunk
    })
    request.on('end', () => {
      const body = raw ? JSON.parse(raw) : {}
      const result = handler(body)
      response.writeHead(result.status ?? 200, { 'Content-Type': 'application/json', ...result.headers })
      response.end(typeof result.payload === 'string' ? result.payload : JSON.stringify(result.payload))
    })
  })

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address && typeof address === 'object')

  try {
    await run(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  }
}

function settings(baseUrl) {
  return {
    llmBaseUrl: baseUrl,
    llmApiKey: 'test-key',
    llmModel: 'gpt-5.4'
  }
}

function hasFinalTextReminder(body) {
  return body.messages?.some((message) =>
    typeof message.content === 'string' && message.content.includes('上一次请求没有返回可展示')
  )
}

test('retries OpenAI-compatible parameter variants until the proxy accepts one', async () => {
  const { postOpenAICompatibleChat, cleanup } = await importProviderForTest()
  const requests = []
  try {
    await withMockChatServer((body) => {
      requests.push(body)
      if ('max_completion_tokens' in body) {
        return {
          status: 400,
          payload: { error: { message: 'unsupported parameter max_completion_tokens' } }
        }
      }
      return {
        payload: {
          choices: [{ finish_reason: 'stop', message: { content: '兼容代理文本' } }],
          usage: { prompt_tokens: 4, completion_tokens: 5, total_tokens: 9 }
        }
      }
    }, async (baseUrl) => {
      const text = await postOpenAICompatibleChat(settings(baseUrl), [{ role: 'user', content: 'hello' }], 128)
      assert.equal(text, '兼容代理文本')
    })

    assert.ok(requests.some((body) => 'max_tokens' in body))
  } finally {
    await cleanup()
  }
})

test('non-stream requests retry a transient compatible-proxy failure', async () => {
  const { postOpenAICompatibleChat, cleanup } = await importProviderForTest()
  let calls = 0
  try {
    await withMockChatServer(() => {
      calls += 1
      if (calls === 1) {
        return {
          status: 503,
          payload: { error: { message: 'temporary upstream unavailable' } }
        }
      }
      return {
        payload: {
          choices: [{ finish_reason: 'stop', message: { content: 'OK' } }],
          usage: { prompt_tokens: 4, completion_tokens: 1, total_tokens: 5 }
        }
      }
    }, async (baseUrl) => {
      const text = await postOpenAICompatibleChat(settings(baseUrl), [{ role: 'user', content: 'hello' }], 128)
      assert.equal(text, 'OK')
    })
    assert.equal(calls, 2)
  } finally {
    await cleanup()
  }
})

test('probe sends a valid PNG image payload to the multimodal provider', async () => {
  const { probeOpenAICompatibleProvider, cleanup } = await importProviderForTest()
  const requests = []
  try {
    await withMockChatServer((body) => {
      requests.push(body)
      if (Array.isArray(body.tools) && body.tools.some((tool) => tool.function?.name === 'readiness_check')) {
        return {
          payload: {
            choices: [{
              finish_reason: 'tool_calls',
              message: {
                content: '',
                tool_calls: [{
                  id: 'call_readiness',
                  type: 'function',
                  function: { name: 'readiness_check', arguments: '{"value":"goagent"}' }
                }]
              }
            }],
            usage: { prompt_tokens: 8, completion_tokens: 1, total_tokens: 9 }
          }
        }
      }
      const hasImage = body.messages?.some((message) =>
        Array.isArray(message.content) && message.content.some((part) => part.type === 'image_url')
      )
      return {
        payload: {
          choices: [{ finish_reason: 'stop', message: { content: hasImage ? 'BLUE' : 'OK' } }],
          usage: { prompt_tokens: 8, completion_tokens: 1, total_tokens: 9 }
        }
      }
    }, async (baseUrl) => {
      const result = await probeOpenAICompatibleProvider(settings(baseUrl))
      assert.equal(result.ok, true)
      assert.equal(result.supportsImage, true)
      assert.equal(result.capabilities?.text.ok, true)
      assert.equal(result.capabilities?.vision.ok, true)
      assert.equal(result.capabilities?.tools.ok, true)
    })

    const imagePart = requests.flatMap((request) => request.messages ?? [])
      .flatMap((message) => Array.isArray(message.content) ? message.content : [])
      .find((part) => part.type === 'image_url')
    assert.ok(imagePart, 'probe should include an image part')
    const imageUrl = imagePart.image_url.url
    assert.ok(imageUrl.startsWith('data:image/png;base64,'))
    const bytes = Buffer.from(imageUrl.replace('data:image/png;base64,', ''), 'base64')
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
    assert.equal(bytes.readUInt32BE(16), 64)
    assert.equal(bytes.readUInt32BE(20), 64)
  } finally {
    await cleanup()
  }
})

test('probe rejects a model that accepts image payloads but does not identify the image', async () => {
  const { probeOpenAICompatibleProvider, cleanup } = await importProviderForTest()
  try {
    await withMockChatServer((body) => {
      if (Array.isArray(body.tools)) {
        return {
          payload: {
            choices: [{
              finish_reason: 'tool_calls',
              message: {
                content: '',
                tool_calls: [{
                  id: 'call_readiness',
                  type: 'function',
                  function: { name: 'readiness_check', arguments: '{"value":"goagent"}' }
                }]
              }
            }]
          }
        }
      }
      return {
        payload: { choices: [{ finish_reason: 'stop', message: { content: 'OK' } }] }
      }
    }, async (baseUrl) => {
      const result = await probeOpenAICompatibleProvider(settings(baseUrl))
      assert.equal(result.ok, false)
      assert.equal(result.capabilities?.text.ok, true)
      assert.equal(result.capabilities?.vision.ok, false)
      assert.equal(result.capabilities?.tools.ok, true)
    })
  } finally {
    await cleanup()
  }
})

test('asks once more for final text after a stop response spends tokens but returns empty content', async () => {
  const { postOpenAICompatibleChat, cleanup } = await importProviderForTest()
  const requests = []
  try {
    await withMockChatServer((body) => {
      requests.push(body)
      if (hasFinalTextReminder(body)) {
        return {
          payload: {
            choices: [{ finish_reason: 'stop', message: { content: '最终给学生看的讲解文本' } }],
            usage: { prompt_tokens: 12, completion_tokens: 18, total_tokens: 30 }
          }
        }
      }
      return {
        payload: {
          choices: [{ finish_reason: 'stop', message: { content: '' } }],
          usage: {
            prompt_tokens: 6977,
            completion_tokens: 1436,
            total_tokens: 8413,
            completion_tokens_details: { reasoning_tokens: 66 }
          }
        }
      }
    }, async (baseUrl) => {
      const text = await postOpenAICompatibleChat(settings(baseUrl), [{ role: 'user', content: '讲解当前手' }], 512)
      assert.equal(text, '最终给学生看的讲解文本')
    })

    assert.ok(requests.length > 1)
    assert.ok(hasFinalTextReminder(requests.at(-1)))
  } finally {
    await cleanup()
  }
})

test('falls back to streaming when a reasoning model returns empty non-stream content', async () => {
  const { postOpenAICompatibleChat, cleanup } = await importProviderForTest()
  const requests = []
  try {
    await withMockChatServer((body) => {
      requests.push(body)
      if (body.stream) {
        return {
          payload: [
            'data: {"choices":[{"delta":{"content":"流式"},"finish_reason":null}]}',
            'data: {"choices":[{"delta":{"content":"讲解"},"finish_reason":null}]}',
            'data: [DONE]',
            ''
          ].join('\n\n')
        }
      }
      return {
        payload: {
          choices: [{ finish_reason: 'stop', message: { content: '', reasoning_content: null, tool_calls: [] } }],
          usage: {
            prompt_tokens: 180,
            completion_tokens: 44,
            total_tokens: 224,
            completion_tokens_details: { reasoning_tokens: 37 }
          }
        }
      }
    }, async (baseUrl) => {
      const text = await postOpenAICompatibleChat(settings(baseUrl), [{ role: 'user', content: '讲解当前手' }], 512)
      assert.equal(text, '流式讲解')
    })

    assert.ok(requests.some((body) => body.stream === true))
  } finally {
    await cleanup()
  }
})

test('streamOpenAICompatibleChat emits visible deltas as they arrive', async () => {
  const { streamOpenAICompatibleChat, cleanup } = await importProviderForTest()
  const chunks = []
  try {
    await withMockChatServer((body) => {
      assert.equal(body.stream, true)
      return {
        payload: [
          'data: {"choices":[{"delta":{"content":"第一段"},"finish_reason":null}]}',
          'data: {"choices":[{"delta":{"content":"，继续"},"finish_reason":null}]}',
          'data: [DONE]',
          ''
        ].join('\n\n')
      }
    }, async (baseUrl) => {
      const text = await streamOpenAICompatibleChat(settings(baseUrl), [{ role: 'user', content: '讲解当前手' }], 512, (delta) => chunks.push(delta))
      assert.equal(text, '第一段，继续')
    })

    assert.deepEqual(chunks, ['第一段', '，继续'])
  } finally {
    await cleanup()
  }
})

test('tool-call turns return tool calls instead of empty-text errors', async () => {
  const { postOpenAICompatibleToolTurn, cleanup } = await importProviderForTest()
  const requests = []
  try {
    await withMockChatServer((body) => {
      requests.push(body)
      return {
        payload: {
          choices: [{
            finish_reason: 'tool_calls',
            message: {
              content: '',
              tool_calls: [{
                id: 'call_1',
                type: 'function',
                function: {
                  name: 'katago_analyzePosition',
                  arguments: '{"gameId":"g1","moveNumber":42}'
                }
              }]
            }
          }],
          usage: { prompt_tokens: 8, completion_tokens: 12, total_tokens: 20 }
        }
      }
    }, async (baseUrl) => {
      const turn = await postOpenAICompatibleToolTurn(
        settings(baseUrl),
        [{ role: 'user', content: '分析当前手' }],
        [{
          type: 'function',
          function: {
            name: 'katago_analyzePosition',
            description: 'Analyze a Go position',
            parameters: { type: 'object', properties: {} }
          }
        }],
        512
      )
      assert.equal(turn.text, '')
      assert.equal(turn.toolCalls.length, 1)
      assert.equal(turn.toolCalls[0].function.name, 'katago_analyzePosition')
      assert.match(turn.toolCalls[0].function.arguments, /moveNumber/)
    })

    assert.equal(requests[0].tools[0].function.name, 'katago_analyzePosition')
  } finally {
    await cleanup()
  }
})

test('stream tool turns accumulate streamed tool-call arguments', async () => {
  const { streamOpenAICompatibleToolTurn, cleanup } = await importProviderForTest()
  try {
    await withMockChatServer((body) => {
      assert.equal(body.stream, true)
      return {
        payload: [
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_s","type":"function","function":{"name":"knowledge_searchLocal","arguments":"{\\"text\\":"}}]},"finish_reason":null}]}',
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"定式\\"}"}}]},"finish_reason":null}]}',
          'data: [DONE]',
          ''
        ].join('\n\n')
      }
    }, async (baseUrl) => {
      const turn = await streamOpenAICompatibleToolTurn(
        settings(baseUrl),
        [{ role: 'user', content: '查知识库' }],
        [{
          type: 'function',
          function: {
            name: 'knowledge_searchLocal',
            description: 'Search local knowledge',
            parameters: { type: 'object', properties: {} }
          }
        }],
        512
      )
      assert.equal(turn.toolCalls.length, 1)
      assert.equal(turn.toolCalls[0].function.name, 'knowledge_searchLocal')
      assert.equal(turn.toolCalls[0].function.arguments, '{"text":"定式"}')
    })
  } finally {
    await cleanup()
  }
})

test('stream tool turns retry a transient proxy EOF before any visible output', async () => {
  const { streamOpenAICompatibleToolTurn, cleanup } = await importProviderForTest()
  let calls = 0
  try {
    await withMockChatServer(() => {
      calls += 1
      if (calls === 1) {
        return {
          status: 500,
          payload: { error: { message: 'upstream responses request ended with EOF' } }
        }
      }
      return {
        payload: [
          'data: {"choices":[{"delta":{"content":"复盘完成"},"finish_reason":"stop"}]}',
          'data: [DONE]',
          ''
        ].join('\n\n')
      }
    }, async (baseUrl) => {
      const turn = await streamOpenAICompatibleToolTurn(
        settings(baseUrl),
        [{ role: 'user', content: '分析整盘围棋' }],
        [],
        512
      )
      assert.equal(turn.text, '复盘完成')
    })
    assert.equal(calls, 2)
  } finally {
    await cleanup()
  }
})

test('stream tool turns do not retry authentication failures', async () => {
  const { streamOpenAICompatibleToolTurn, isLlmSetupConfigurationError, cleanup } = await importProviderForTest()
  let calls = 0
  try {
    await withMockChatServer(() => {
      calls += 1
      return {
        status: 401,
        payload: { error: { message: 'invalid API key' } }
      }
    }, async (baseUrl) => {
      await assert.rejects(
        streamOpenAICompatibleToolTurn(settings(baseUrl), [{ role: 'user', content: 'hello' }], [], 128),
        /401/
      )
    })
    assert.equal(calls, 1)
    assert.equal(isLlmSetupConfigurationError(new Error('LLM request failed: 401 invalid API key')), true)
    assert.equal(isLlmSetupConfigurationError(new Error('LLM request failed: 500 upstream EOF')), false)
  } finally {
    await cleanup()
  }
})

test('does not retry empty responses caused by content filtering', async () => {
  const { postOpenAICompatibleChat, cleanup } = await importProviderForTest()
  let calls = 0
  try {
    await withMockChatServer(() => {
      calls += 1
      return {
        payload: {
          choices: [{ finish_reason: 'content_filter', message: { content: '' } }],
          usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 }
        }
      }
    }, async (baseUrl) => {
      await assert.rejects(
        postOpenAICompatibleChat(settings(baseUrl), [{ role: 'user', content: 'hello' }], 128),
        /finish_reason=content_filter/
      )
    })

    assert.equal(calls, 1)
  } finally {
    await cleanup()
  }
})

test('cancelling a teacher run stops a stream whose headers already arrived', async () => {
  const { streamOpenAICompatibleToolTurn, cleanup } = await importProviderForTest()
  let upstreamClosed
  const upstreamClosedPromise = new Promise((resolve) => {
    upstreamClosed = resolve
  })
  // The model keeps generating: one delta, then the stream stays open.
  const server = createServer((request, response) => {
    request.resume()
    request.on('end', () => {
      response.writeHead(200, { 'Content-Type': 'text/event-stream' })
      response.write('data: {"choices":[{"delta":{"content":"第一句"},"finish_reason":null}]}\n\n')
    })
    response.on('close', () => upstreamClosed())
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  const controller = new AbortController()
  try {
    const turn = streamOpenAICompatibleToolTurn(
      settings(`http://127.0.0.1:${port}`),
      [{ role: 'user', content: '讲一下这手棋' }],
      [],
      512,
      () => controller.abort(new Error('老师任务已停止')),
      controller.signal
    )
    let deadlineTimer
    const deadline = new Promise((_, reject) => {
      deadlineTimer = setTimeout(() => reject(new Error('stream kept running after cancel')), 3000)
    })
    await assert.rejects(Promise.race([turn, deadline]), /老师任务已停止/)
    clearTimeout(deadlineTimer)
    await upstreamClosedPromise
  } finally {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
    await cleanup()
  }
})

async function withRawServer(handler, run) {
  const server = createServer(handler)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    await run(`http://127.0.0.1:${server.address().port}`)
  } finally {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  }
}

test('request deadlines and external cancellation remain active after headers', async () => {
  const { fetchWithTimeout, cleanup } = await importProviderForTest()
  try {
    await withRawServer((_request, response) => {
      response.writeHead(200)
      response.flushHeaders()
    }, async (url) => {
      const controller = new AbortController()
      const timed = await fetchWithTimeout(url, {}, 200, controller.signal)
      try {
        await assert.rejects(timed.response.text(), /abort|超时/i)
      } finally {
        timed.dispose()
      }
      assert.equal(getEventListeners(controller.signal, 'abort').length, 0)

      const cancelled = await fetchWithTimeout(url, {}, 10_000, controller.signal)
      const body = cancelled.response.text()
      controller.abort(new Error('user cancelled'))
      try {
        await assert.rejects(body, /abort|cancel/i)
      } finally {
        cancelled.dispose()
      }
      assert.equal(getEventListeners(controller.signal, 'abort').length, 0)
    })
  } finally {
    await cleanup()
  }
})

test('completed and failed requests release cancellation listeners', async () => {
  const { fetchWithTimeout, cleanup } = await importProviderForTest()
  const controller = new AbortController()
  try {
    await withRawServer((_request, response) => response.end('OK'), async (url) => {
      for (let i = 0; i < 12; i += 1) {
        const { response, dispose } = await fetchWithTimeout(url, {}, 10_000, controller.signal)
        try { assert.equal(await response.text(), 'OK') } finally { dispose() }
        assert.equal(getEventListeners(controller.signal, 'abort').length, 0)
      }
      controller.abort(new Error('cancelled'))
      await assert.rejects(fetchWithTimeout(url, {}, 10_000, controller.signal), /cancelled/)
      assert.equal(getEventListeners(controller.signal, 'abort').length, 0)
    })
  } finally {
    await cleanup()
  }
})

test('Retry-After accepts seconds and HTTP dates and rejects invalid values', async () => {
  const { parseRetryAfter, cleanup } = await importProviderForTest()
  try {
    const now = Date.parse('2026-01-01T00:00:00Z')
    assert.equal(parseRetryAfter('2', now), 2000)
    assert.equal(parseRetryAfter('0.5', now), 500)
    assert.equal(parseRetryAfter('Thu, 01 Jan 2026 00:00:05 GMT', now), 5000)
    assert.equal(parseRetryAfter('Wed, 31 Dec 2025 23:59:59 GMT', now), 0)
    for (const value of [null, '', 'later', '-1', 'Infinity']) assert.equal(parseRetryAfter(value, now), null)
  } finally {
    await cleanup()
  }
})

test('chat, tool and streamed tool retries respect the provider cooldown', async () => {
  const provider = await importProviderForTest()
  try {
    for (const method of ['postOpenAICompatibleChat', 'postOpenAICompatibleToolTurn', 'streamOpenAICompatibleToolTurn']) {
      const times = []
      await withMockChatServer(() => {
        times.push(performance.now())
        if (times.length === 1) return { status: 429, headers: { 'Retry-After': '1.2' }, payload: 'busy' }
        const json = { choices: [{ message: { content: 'OK' }, finish_reason: 'stop' }] }
        return { payload: method.startsWith('stream') ? `data: ${JSON.stringify(json)}\n\ndata: [DONE]\n\n` : json }
      }, async (url) => {
        const args = method === 'postOpenAICompatibleChat' ? [128] : [[], 128]
        const result = await provider[method](settings(url), [{ role: 'user', content: 'hello' }], ...args)
        assert.equal(typeof result === 'string' ? result : result.text, 'OK')
      })
      assert.equal(times.length, 2, method)
      assert.ok(times[1] - times[0] >= 1180, `${method}: ${times[1] - times[0]} ms`)
    }
  } finally {
    await provider.cleanup()
  }
})

test('long provider cooldowns are not shortened and plain streaming does not immediately fall back', async () => {
  const provider = await importProviderForTest()
  try {
    for (const method of ['postOpenAICompatibleChat', 'postOpenAICompatibleToolTurn', 'streamOpenAICompatibleToolTurn', 'streamOpenAICompatibleChat']) {
      let calls = 0
      await withMockChatServer(() => {
        calls += 1
        return { status: 503, headers: { 'Retry-After': '120' }, payload: 'busy' }
      }, async (url) => {
        const args = method.includes('Tool') ? [[], 128] : [128]
        await assert.rejects(provider[method](settings(url), [], ...args), /503/)
      })
      assert.equal(calls, 1, method)
    }
  } finally {
    await provider.cleanup()
  }
})

test('cancelling during Retry-After stops the wait without another request', async () => {
  const provider = await importProviderForTest()
  const controller = new AbortController()
  let calls = 0
  let cancelTimer
  try {
    await withMockChatServer(() => {
      calls += 1
      cancelTimer = setTimeout(() => controller.abort(new Error('user cancelled')), 100)
      return { status: 429, headers: { 'Retry-After': '30' }, payload: 'busy' }
    }, async (url) => {
      await assert.rejects(provider.streamOpenAICompatibleToolTurn(settings(url), [], [], 128, undefined, controller.signal), /cancelled/)
    })
    assert.equal(calls, 1)
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0)
  } finally {
    clearTimeout(cancelTimer)
    await provider.cleanup()
  }
})

test('SSE DONE completes both streaming APIs even if the proxy leaves the connection open', { timeout: 5000 }, async () => {
  const provider = await importProviderForTest()
  try {
    await withRawServer((request, response) => {
      request.resume()
      request.on('end', () => {
        response.writeHead(200, { 'Content-Type': 'text/event-stream' })
        response.write('data: {"choices":[{"delta":{"content":"OK"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n')
      })
    }, async (url) => {
      assert.equal(await provider.streamOpenAICompatibleChat(settings(url), [], 128), 'OK')
      const controller = new AbortController()
      const turn = await provider.streamOpenAICompatibleToolTurn(settings(url), [], [], 128, undefined, controller.signal)
      assert.equal(turn.text, 'OK')
      assert.equal(getEventListeners(controller.signal, 'abort').length, 0)
    })
  } finally {
    await provider.cleanup()
  }
})

test('empty reasoning responses do not bypass a subsequent provider cooldown via streaming fallback', async () => {
  const provider = await importProviderForTest()
  let calls = 0
  try {
    await withMockChatServer(() => {
      calls++
      if (calls === 1) return { payload: { choices: [{ finish_reason: 'stop', message: { content: '' } }], usage: { completion_tokens: 10 } } }
      return { status: 429, headers: { 'Retry-After': '120' }, payload: 'busy' }
    }, async (url) => {
      await assert.rejects(provider.postOpenAICompatibleChat(settings(url), [], 128), /429/)
    })
    assert.equal(calls, 2)
  } finally { await provider.cleanup() }
})
