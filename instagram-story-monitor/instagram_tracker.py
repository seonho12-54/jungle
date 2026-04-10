import json
import os
import requests
from datetime import datetime

# --- 설정값 ---
SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL", "YOUR_SLACK_WEBHOOK_URL_HERE")
FOLLOWERS_BASELINE_FILE = "/home/ubuntu/instagram_followers_baseline.json"
FOLLOWING_BASELINE_FILE = "/home/ubuntu/instagram_following_baseline.json"

def load_json(file_path):
    if os.path.exists(file_path):
        with open(file_path, 'r') as f:
            return json.load(f)
    return None

def save_json(file_path, data):
    with open(file_path, 'w') as f:
        json.dump(data, f, indent=4)

def send_slack(message):
    payload = {"text": message}
    try:
        requests.post(SLACK_WEBHOOK_URL, json=payload)
    except Exception as e:
        print(f"Slack error: {e}")

def check_unfollows(current_followers):
    baseline = load_json(FOLLOWERS_BASELINE_FILE)
    if not baseline:
        return []
    
    old_followers = set(baseline.get("followers", []))
    new_followers = set(current_followers)
    
    unfollowed = old_followers - new_followers
    return list(unfollowed)

def check_blocks(current_following):
    # 차단 확인은 팔로잉 리스트에서 사라진 사람을 기준으로 추정
    baseline = load_json(FOLLOWING_BASELINE_FILE)
    if not baseline:
        return []
    
    old_following = set(baseline.get("following", []))
    new_following = set(current_following)
    
    potential_blocks = old_following - new_following
    return list(potential_blocks)

def check_non_follower_viewers(story_viewers, current_followers):
    followers_set = set(current_followers)
    non_followers = [viewer for viewer in story_viewers if viewer not in followers_set]
    return non_followers

def main():
    # 이 스크립트는 Manus가 브라우저 자동화로 수집한 데이터를 인자로 받아 실행되거나
    # 직접 브라우저를 제어하여 데이터를 수집하는 로직을 포함해야 합니다.
    # 여기서는 로직의 구조를 보여줍니다.
    pass

if __name__ == "__main__":
    main()
