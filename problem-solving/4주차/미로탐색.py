# deque를 쓰기 위해 import
# BFS에서는 맨 앞에서 빼고, 맨 뒤에 넣는 작업이 많아서 deque가 필수에 가깝다.
from collections import deque

# a = 세로 길이(행 개수)
# b = 가로 길이(열 개수)
a, b = map(int, input().split())

# 미로 입력 받기
# 예를 들어 101111 이런 식으로 들어오면
# input().strip() -> "101111"
# map(int, input().strip()) -> 1,0,1,1,1,1
# list(...) -> [1,0,1,1,1,1]
# 이걸 a줄 만큼 반복해서 2차원 리스트로 만든다.
graph = [list(map(int, input().strip())) for _ in range(a)]

# 방문 여부를 저장하는 2차원 리스트
# 처음에는 전부 False (아직 방문 안 함)
visited = [[False] * b for _ in range(a)]

# 상, 하, 좌, 우 이동용 방향 벡터
# 현재 위치가 (x, y)일 때:
# 위    -> (x-1, y)
# 아래  -> (x+1, y)
# 왼쪽  -> (x, y-1)
# 오른쪽-> (x, y+1)
dx = [-1, 1, 0, 0]
dy = [0, 0, -1, 1]


def bfs(graph, visited, start):
    # BFS에서 사용할 큐 생성
    queue = deque()

    # 시작 위치를 큐에 넣음
    # start는 (0, 0) 같은 튜플 형태로 들어온다.
    queue.append(start)

    # 시작 위치 방문 처리
    visited[start[0]][start[1]] = True

    # 큐가 빌 때까지 반복
    while queue:
        # 큐의 맨 앞 좌표를 꺼냄
        # 먼저 들어간 좌표가 먼저 나온다. (FIFO)
        x, y = queue.popleft()

        # 현재 위치에서 4방향 확인
        for i in range(4):
            # 다음 위치 계산
            nx = x + dx[i]
            ny = y + dy[i]

            # 다음 위치가 미로 범위 안에 있는지 확인
            if 0 <= nx < a and 0 <= ny < b:

                # 그 칸이 갈 수 있는 길(1)이고, 아직 방문하지 않았다면
                if graph[nx][ny] == 1 and not visited[nx][ny]:

                    # 큐에 넣기
                    queue.append((nx, ny))

                    # 방문 처리
                    visited[nx][ny] = True

                    # 거리 갱신
                    # 현재 칸까지의 거리 + 1 을 다음 칸에 저장
                    # 처음 graph에는 0,1만 있었지만
                    # BFS가 진행되면서 1,2,3,4... 식으로 최단거리가 저장된다.
                    graph[nx][ny] = graph[x][y] + 1


# (0, 0)에서 BFS 시작
bfs(graph, visited, (0, 0))

# 도착 지점(a-1, b-1)에 저장된 값을 출력
# 이 값이 시작점에서 도착점까지의 최단 거리
print(graph[a-1][b-1])