# Always-on Story Monitor

이 프로젝트는 브라우저에 스크립트를 붙여서 한 번 실행하는 방식이 아니라, 서버가 직접 페이지를 열어 주기적으로 검사하고 Slack으로 알림을 보내는 방식입니다.

중요한 점:

- 내 PC의 Docker Desktop에서 실행하면 PC가 켜져 있는 동안만 동작합니다.
- PC를 꺼도 계속 돌게 하려면 Render 같은 클라우드 서버에 배포해야 합니다.

## 로컬에서 Docker로 실행

기본 포트는 이제 `3001`입니다.

1. 이미지 빌드

```bash
docker build -t always-on-story-monitor .
```

2. 컨테이너 실행

PowerShell:

```powershell
docker run -d `
  --name story-monitor `
  --restart unless-stopped `
  -p 3001:3001 `
  -v story-monitor-data:/app/data `
  -e "SLACK_WEBHOOK_URL=https://hooks.slack.com/services/REPLACE_ME" `
  -e "MONITOR_USERS=yexnduo,jae.lol__" `
  -e "MONITOR_INTERVAL_MS=60000" `
  -e "WAIT_AFTER_SEARCH_MS=3000" `
  -e "BETWEEN_USERS_MS=1500" `
  -e "MONITOR_HEADLESS=true" `
  always-on-story-monitor
```

3. 확인

- 대시보드: `http://localhost:3001`
- 상태 API: `http://localhost:3001/api/status`
- 헬스 체크: `http://localhost:3001/health`

## Docker Desktop에서 직접 넣는 값

`Images`에서 `always-on-story-monitor`를 실행할 때 아래처럼 넣으면 됩니다.

- Container name: `story-monitor`
- Host port: `3001`
- Container port: `3001`
- Volume name: `story-monitor-data`
- Container path: `/app/data`

환경 변수:

```text
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/REPLACE_ME
MONITOR_USERS=yexnduo,jae.lol__
MONITOR_INTERVAL_MS=60000
WAIT_AFTER_SEARCH_MS=3000
BETWEEN_USERS_MS=1500
MONITOR_HEADLESS=true
STATE_FILE_PATH=/app/data/monitor-state.json
PORT=3001
```

## 왜 HTML에서 한 번만 실행된 것처럼 보였나

서버는 원래도 반복 실행 구조였지만, 대시보드에서 그 사실이 잘 드러나지 않았습니다.

이제 대시보드에서 아래 항목을 확인할 수 있습니다.

- 다음 자동 실행 시각
- 누적 실행 횟수
- 최근 이벤트

즉 `누적 실행 횟수`가 계속 올라가고 `다음 자동 실행`이 갱신되면 반복 실행이 정상입니다.

## PC를 꺼도 계속 돌게 하는 방법

정답은 로컬 Docker가 아니라 클라우드 배포입니다.

가장 쉬운 방법은 `Render`에 Docker 서비스로 올리는 것입니다.

이 저장소에는 `render.yaml`도 포함되어 있습니다.

배포 순서:

1. 이 프로젝트를 GitHub에 올립니다.
2. Render에서 새 Blueprint 또는 Web Service를 만듭니다.
3. 이 저장소를 연결합니다.
4. 환경 변수 `SLACK_WEBHOOK_URL`, `MONITOR_USERS`를 넣습니다.
5. Render가 이 저장소의 `Dockerfile`로 이미지를 빌드하고 계속 실행합니다.
6. 영구 디스크는 `/app/data`에 연결해서 상태 파일을 유지합니다.

## 주요 환경 변수

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/REPLACE_ME
MONITOR_USERS=yexnduo,jae.lol__
MONITOR_INTERVAL_MS=60000
WAIT_AFTER_SEARCH_MS=3000
BETWEEN_USERS_MS=1500
MONITOR_HEADLESS=true
SAVEFROM_URL=https://en1.savefrom.net/71/
STATE_FILE_PATH=/app/data/monitor-state.json
SELECTOR_TIMEOUT_MS=15000
PAGE_TIMEOUT_MS=30000
PORT=3001
```

## 지금 코드가 하는 일

- 서버가 주기적으로 대상 페이지를 엽니다.
- 각 계정을 검색합니다.
- `.ig-stories__card` 개수를 읽습니다.
- 이전 개수보다 늘었으면 Slack으로 알림을 보냅니다.
- 마지막 상태를 파일에 저장합니다.
- 대시보드에서 자동 반복 실행 상태를 보여줍니다.

## 주의

- 사이트 구조가 바뀌면 셀렉터를 수정해야 합니다.
- 로컬 Docker Desktop은 PC가 꺼지면 같이 멈춥니다.
- Slack 웹훅이 노출되면 새 웹훅으로 교체하는 것이 안전합니다.
