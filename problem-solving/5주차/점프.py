from collections import deque
import sys

input = sys.stdin.readline

def bfs(n, small):
    queue = deque()
    visited = set()

    # 처음은 무조건 1 -> 2 로 1칸 점프
    if 2 in small:
        return -1

    queue.append((2, 1, 1))  
    # (현재 위치, 이전 점프 길이, 점프 횟수)

    visited.add((2, 1))
    # 방문한 위치와 점프 길이를 튜플로 저장하여 중복 방문 방지
    
    while queue:
        pos, jump, cnt = queue.popleft()

        if pos == n: #목적지에 도착하면 점프 횟수 반환
            return cnt

        for next_jump in (jump - 1, jump, jump + 1): #다음 점프 길이는 이전 점프 길이에서 -1, 0, +1 중 하나
            if next_jump < 1:#점프 길이는 1 이상이어야 하므로 0 이하인 경우는 무시
                continue

            next_pos = pos + next_jump#다음 위치는 현재 위치에서 다음 점프 길이만큼 이동한 위치

            if next_pos > n:#목적지보다 멀리 이동하는 경우는 무시
                continue
            if next_pos in small:#작은 돌이 있는 위치는 무시
                continue
            if (next_pos, next_jump) in visited:#이미 방문한 위치와 점프 길이 조합은 무시
                continue

            visited.add((next_pos, next_jump))#방문한 위치와 점프 길이 조합을 방문 처리
            queue.append((next_pos, next_jump, cnt + 1))#다음 위치, 다음 점프 길이, 점프 횟수 + 1을 큐에 추가

    return -1


n, m = map(int, input().split())

small = set()
for _ in range(m):
    small.add(int(input()))

print(bfs(n, small))