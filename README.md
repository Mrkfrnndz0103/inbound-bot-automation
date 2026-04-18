# Inbound Bot Automation

This repository is now split into fully separated app folders.

## Apps

- [otp_hourly](otp_hourly/README.md): the OTP hourly SeaTalk bot.
- [otp_controltower](otp_controltower/README.md): a fully separated control tower SeaTalk bot with the same runtime behavior as `otp_hourly`.

## Structure

```text
Inbound-bot-automation/
|-- otp_hourly/
`-- otp_controltower/
```

Each app should keep its own:

- `bot_server.py`
- `README.md`
- `.env.example`
- `Dockerfile`
- `docker-compose.yml`
- `requirements.txt`
- `docs/`

Deploy and configure each app from its own folder.
