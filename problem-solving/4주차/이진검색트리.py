import sys
sys.setrecursionlimit(10**6)




lst = list(map(int, sys.stdin.read().split()))
idx = 0
n = len(lst)
result = []



def dfs(left, right):
    global idx
    if idx == n:
        return
    
    x = lst[idx]
    
    if not (left < x < right):
        return
    
    
    
    idx += 1
    dfs(left, x)
    dfs(x, right)
    result.append(x)
dfs(float('-inf'), float('inf'))
print('\n'.join(map(str, result)))


    """
    
    import sys

pre = list(map(int, sys.stdin.read().split()))
n = len(pre)
idx = 0
result = []

# (low, high, state, root)
# state = 0 -> 아직 처리 전
# state = 1 -> 왼쪽/오른쪽 끝났으니 root 출력
stack = [(0, 10**6 + 1, 0, 0)]

while stack:
    low, high, state, root = stack.pop()

    if state == 1:
        result.append(str(root))
        continue

    if idx == n:
        continue

    x = pre[idx]

    if not (low < x < high):
        continue

    idx += 1

    # 후위순회: 왼쪽 -> 오른쪽 -> 루트
    stack.append((low, high, 1, x))   # 마지막에 root 출력
    stack.append((x, high, 0, 0))     # 오른쪽
    stack.append((low, x, 0, 0))      # 왼쪽

sys.stdout.write('\n'.join(result))
    
    
    """
    
    
    #bfs 입니다.
    