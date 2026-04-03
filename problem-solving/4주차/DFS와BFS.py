n, m, start = map(int, input().split())

graph = [[] for _ in range(n + 1)]
visited = [False] * (n + 1)

for _ in range(m):
    a, b = map(int, input().split())
    graph[a].append(b)
    graph[b].append(a)

for i in range(1, n + 1):
    graph[i].sort()

def dfs(graph, visited, start):
    visited[start] = True
    print(start, end=' ')
    for i in graph[start]:
        if not visited[i]:
            dfs(graph, visited, i)

dfs(graph, visited, start)

print()




visited = [False] * (n + 1)

def bfs(graph, visited, start):
    queue = [start]
    visited[start] = True
    while queue:
        v = queue.pop(0)
        print(v, end=' ')
        for i in graph[v]:
            if not visited[i]:
                queue.append(i)
                visited[i] = True

bfs(graph, visited, start)