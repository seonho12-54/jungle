n = int(input())


arr = [tuple(map(int, input().split())) for _ in range(n)]


arr.sort(key=lambda x: (x[1], x[0]))

count = 0

end  =0



print(arr)



for s, e in arr:
    if s >= end:
        count += 1
        end = e

print(count)