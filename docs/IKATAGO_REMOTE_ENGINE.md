# iKataGo Remote Engine

GoAgent can use an existing `ikatago-client` as a remote KataGo analysis engine. This is for users whose local machine is slow but who already run or rent an iKataGo server.

## How It Works

iKataGo's public client model is:

```text
Go GUI -> local ikatago-client -> remote iKataGo server -> remote KataGo
```

GoAgent uses the same idea, but asks the remote client to run KataGo's `analysis` subcommand:

```bash
ikatago --platform all --username USER --password PASS -- analysis
```

GoAgent then sends normal KataGo analysis JSON through stdin and reads JSON lines from stdout. This keeps the existing move classification, trace packet, cache, timeline, teacher and LLM evidence pipeline unchanged.

## Settings

Open **Settings -> Analysis Engine** and choose:

- `Auto`: local engine first. If iKataGo is configured and "use when local is slow" is enabled, GoAgent can prefer iKataGo when the benchmark is below the configured visits/s threshold.
- `Persistent`: local long-lived KataGo only.
- `Spawn`: local spawn-per-batch only.
- `iKataGo Remote`: use only iKataGo. If the remote client fails, GoAgent reports the failure instead of silently switching.

Required iKataGo fields:

- Client path: path to `ikatago` or `ikatago.exe`.
- Platform: usually `all`, `aistudio`, `colab`, or the platform provided by your server.
- Username.
- Password.

Optional fields:

- World URL: only when your iKataGo server requires a custom world endpoint.
- Extra args: for example `--kata-weight 40b --gpu-type 3090`.

Do not put `-- analysis` in extra args unless you intentionally want to override the subcommand. GoAgent appends `-- analysis` by default.

## Privacy

GoAgent does not automatically upload games to iKataGo. Positions are sent to the remote iKataGo server only when:

- the engine mode is set to `iKataGo Remote`, or
- engine mode is `Auto`, iKataGo is configured, and the user enables "use when local is slow".

中文提示：GoAgent 不会自动上传棋谱或局面；只有用户显式选择 iKataGo 远程算力时才会发送当前分析请求。

The iKataGo password is stored in GoAgent's app-local encrypted secret store. It does not use macOS Keychain / Windows Credential Manager, so it should not trigger OS password prompts.

Because the public iKataGo client accepts `--password` as a process argument, the password may be visible in OS process lists while the remote engine is running on a shared machine. Prefer a personal desktop account, a short-lived server account, or an iKataGo token flow if your server supports it.

## Compatibility Notes

GoAgent expects the iKataGo client/server pair to support KataGo's `analysis` subcommand and return one JSON object per line. If the remote setup only supports GTP/Lizzie-style commands, GoAgent will show:

```text
iKataGo 远程引擎没有返回 KataGo analysis JSON
```

In that case, update the iKataGo client/server or remove custom extra args that force the remote process back to `gtp`.

## References

- iKataGo client: `https://github.com/kinfkong/ikatago-client`
- KataGo analysis protocol: `https://github.com/lightvector/KataGo/blob/master/docs/Analysis_Engine.md`
