#!/usr/bin/env python3
import json
import os
import requests
from datetime import datetime, timedelta

# --- 설정값 ---
USERNAMES = ["yexnduo", "jae.lol__"]
SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL", "YOUR_SLACK_WEBHOOK_URL_HERE")
STATE_FILE = "/home/ubuntu/instagram_story_state.json"
TIME_THRESHOLD_HOURS = 24  # 동시 포스팅으로 간주할 시간 차이 (시간) - 다음 날 공유 고려
ALERT_THRESHOLD_DAYS = 30   # 알림을 보낼 기간 (일)

# --- 상태 파일 관리 ---
def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, 'r') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                pass  # 파일이 비어있거나 잘못된 형식일 경우
    return {"last_together_at": None, "notified_at": None}

def save_state(state):
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f, indent=4)

# --- 핵심 로직 ---
def get_stories_from_savefrom(username):
    # 이 함수는 실제 브라우저 자동화 로직으로 대체되어야 합니다.
    # Manus의 browser_navigate, browser_input, browser_view, browser_save_image 등을 사용합니다.
    # 여기서는 시연을 위해 더미 데이터를 반환합니다.
    print(f"[DEBUG] Pretending to scrape stories for {username}")
    # yexnduo는 스토리가 있고, jae.lol__는 없다고 가정
    if username == "yexnduo":
        return [{
            "url": "https://example.com/story_yexnduo.jpg",
            "timestamp": datetime.now().isoformat(),
            "mentions": [] # 실제로는 이미지 분석 또는 텍스트 추출로 채워야 함
        }]
    return []

def check_if_together(stories1, stories2):
    """
    두 계정의 스토리 데이터를 분석하여 함께 있는지 판별합니다.
    1. 이미지 내 직접 언급(@멘션) 확인 (Manus Vision 활용)
    2. 24시간 이내 동시 포스팅 확인
    """
    # 1. 직접 언급 (Mentions) 및 시각 분석
    # Manus가 브라우징 시 각 스토리 이미지를 view 도구로 분석하여 
    # 상대방의 계정명이 텍스트나 태그로 포함되어 있는지 확인합니다.
    for story in stories1 + stories2:
        if "mentions_partner" in story and story["mentions_partner"]:
            print(f"[INFO] Found direct mention in story: {story.get('url')}")
            return True

    # 2. 동시 포스팅 (Simultaneous Posts)
    if stories1 and stories2:
        latest_story1_time = max([datetime.fromisoformat(s['timestamp']) for s in stories1])
        latest_story2_time = max([datetime.fromisoformat(s['timestamp']) for s in stories2])

        if abs(latest_story1_time - latest_story2_time) <= timedelta(hours=TIME_THRESHOLD_HOURS):
            print(f"[INFO] Found simultaneous posts within {TIME_THRESHOLD_HOURS} hours.")
            return True

    return False

def send_slack_notification(message):
    payload = {"text": message}
    try:
        response = requests.post(SLACK_WEBHOOK_URL, json=payload)
        response.raise_for_status()
        print("[INFO] Slack notification sent successfully.")
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] Failed to send Slack notification: {e}")

# --- 메인 실행 ---
def main():
    print("--- Instagram Story Monitor --- ")
    state = load_state()
    
    # 현재는 Savefrom.net에서 두 계정 모두 스토리를 찾지 못했으므로, '함께 있음'으로 간주하지 않습니다.
    # 따라서 실제 스크래핑이 성공해야 로직이 의미있게 동작합니다.
    # 아래는 스크래핑이 성공했다고 가정한 후의 로직입니다.
    
    # stories1 = get_stories_from_savefrom(USERNAMES[0])
    # stories2 = get_stories_from_savefrom(USERNAMES[1])
    # is_together = check_if_together(stories1, stories2)
    is_together = False # 현재 스크래핑 결과 반영

    now = datetime.now()

    if is_together:
        print(f"[SUCCESS] {USERNAMES[0]} and {USERNAMES[1]} are together!")
        state["last_together_at"] = now.isoformat()
        state["notified_at"] = None # 알림 상태 초기화
    else:
        print(f"[INFO] {USERNAMES[0]} and {USERNAMES[1]} are not together in recent stories.")
        last_together_at_str = state.get("last_together_at")
        if last_together_at_str:
            last_together_at = datetime.fromisoformat(last_together_at_str)
            if (now - last_together_at) > timedelta(days=ALERT_THRESHOLD_DAYS):
                # 알림을 보낸 적이 없거나, 마지막으로 함께 있었던 날짜 이후에 보낸 적이 없다면
                notified_at_str = state.get("notified_at")
                if not notified_at_str or datetime.fromisoformat(notified_at_str) < last_together_at:
                    message = f"🚨 [알림] {USERNAMES[0]}님과 {USERNAMES[1]}님이 함께 스토리를 올린 지 {ALERT_THRESHOLD_DAYS}일이 지났습니다."
                    send_slack_notification(message)
                    state["notified_at"] = now.isoformat()

    save_state(state)
    print("--- Monitor run finished ---")

if __name__ == "__main__":
    main()
