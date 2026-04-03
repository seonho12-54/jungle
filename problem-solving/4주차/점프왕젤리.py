n = int(input())
board = [list(map(int, input().split())) for _ in range(n)]

visited = [[False] * n for _ in range(n)]


def dfs(x, y):
    if x>=n or y>=n:
        return False
    if board[x][y] == -1:
        return True
    if visited[x][y]:
        return False
    visited[x][y] = True
    
    jump = board[x][y]
    return dfs(x+jump, y) or dfs(x, y+jump)    





if dfs(0, 0):
    print("HaruHaru")
else:
    print("Hing")