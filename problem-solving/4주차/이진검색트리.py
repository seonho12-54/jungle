import sys
sys.setrecursionlimit(10**6)




lst = [list(map(int, sys.stdin.read().split()))]
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