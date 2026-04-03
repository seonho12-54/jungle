a = int(input()) #컴퓨터수
b = int(input()) #컴퓨터쌍 수







graph = [[] for _ in range(a+1)]

for _ in range(b):
    q, w = map(int, input().split())
    graph[q].append(w)
    graph[w].append(q)
visited = [False] * (a+1)

count = 0

def dfs(graph, visited, start):
    global count
    visited[start] = True
    for i in graph[start]:
        if not visited[i]:
            count +=1
            dfs(graph, visited, i)

dfs(graph, visited, 1)
print(count)