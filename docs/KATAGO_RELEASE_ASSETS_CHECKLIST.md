# KataGo Release Assets Checklist

## P0 策略

- 不把大 binary/model 普通 Git 提交。
- Release 时准备平台对应 binary 和默认 b18 model。
- 安装包必须包含运行所需资源。
- P0 beta 支持 macOS arm64/x64 和 Windows x64。Windows ARM64 暂不支持。
- v0.3.7 起发布 Windows NVIDIA 专版，必须复制完整 CUDA/NVIDIA runtime 目录，不能只把普通 Windows 包改名。

## 资源布局

```text
data/katago/
  manifest.json
  bin/
    darwin-arm64/katago
    darwin-x64/katago
    win32-x64/katago.exe
  models/
    <default-b18-model>.bin.gz
  edition.json        # packaging-time metadata, not committed
```

Windows NVIDIA 专版允许保留来源模型文件名，例如：

```text
data/katago/models/kata1-zhizi-b28c512nbt-muonfd2.bin.gz
```

## 检查命令

开发模式：

```bash
node scripts/check_katago_assets.mjs --mode=dev
```

发布模式：

```bash
node scripts/check_katago_assets.mjs --mode=release
node scripts/p0_release_candidate_check.mjs --mode=release
node scripts/check_nvidia_release_assets.mjs
node scripts/check_release_notes_i18n.mjs
```

## checksum

Release 前应记录：

- binary SHA256
- model SHA256
- 下载来源
- KataGo 版本
- 模型名称

## 不通过标准

- manifest 指向不存在的文件
- Windows 打包没有 `katago.exe`
- NVIDIA 专版没有 `GoAgent-<version>-win-x64-nvidia.exe`
- NVIDIA 专版没有 `GoAgent-<version>-win-x64-nvidia-portable.zip`
- NVIDIA 专版没有复制 `katago.exe` 同目录 runtime 文件
- 生成或上传了 `win-arm64` beta 产物
- macOS 打包没有可执行权限
- 默认模型缺失
- release mode 下检查仍只有 warning 而不是 ready
