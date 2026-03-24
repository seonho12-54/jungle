a, b = map(int, input().split())


k = a - b + 2   # 일자 줄에 쓸 노드 수

for i in range(k - 1):
    print(i, i + 1)

for i in range(k, a):
    print(1, i)