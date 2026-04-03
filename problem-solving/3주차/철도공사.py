import sys
input = sys.stdin.readline

a, b = map(int, input().split())  # 역의 개수, 공사 횟수
lst = list(map(int, input().split()))  # 처음 역 번호들

next = [0] * 1000001
prev = [0] * 1000001

i = 0
while i < len(lst):
    next[lst[i]] = lst[(i + 1) % len(lst)]
    prev[lst[i]] = lst[(i - 1) % len(lst)]
    i += 1

count = 0
while count < b:
    data = input().split()
    cmd = data[0]

    if len(data) == 3:
        i = int(data[1])
        j = int(data[2])

        if cmd == "BN":
            print(next[i])
            old_next = next[i]
            next[i] = j
            prev[j] = i
            next[j] = old_next
            prev[old_next] = j

        elif cmd == "BP":
            print(prev[i])
            old_prev = prev[i]
            next[old_prev] = j
            prev[j] = old_prev
            next[j] = i
            prev[i] = j

    else:
        i = int(data[1])

        if cmd == "CN":
            target = next[i]
            print(target)
            next[i] = next[target]
            prev[next[target]] = i

        elif cmd == "CP":
            target = prev[i]
            print(target)
            prev[i] = prev[target]
            next[prev[target]] = i

    count += 1