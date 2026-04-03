#최소의 동전개수로 원하는 k 값 만들기
#동전은 n 개의 종류 k 는 원하는 값
#bfs 사용

from collections import deque

n, k = map(int, input().split())
coins = []

for _ in range(n):
    coins.append(int(input()))
    
queue = deque()
queue.append((k, 0))  # (남은 금액, 동전 개수)

count = -1

visited = set()  # 방문한 금액을 저장하는 집합
visited.add(k)

while queue:
     remaining_amount, coin_count = queue.popleft()


     if remaining_amount == 0:
         count = coin_count
         break
     for coin in coins:
         if coin <= remaining_amount:
             if remaining_amount - coin not in visited:
                 queue.append((remaining_amount - coin, coin_count + 1))
                 visited.add(remaining_amount - coin)
                 
print(count)