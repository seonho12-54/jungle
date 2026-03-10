def haoi(n, start, mid, end):
    if n == 1:
        print(start, end)
        return

    haoi(n-1, start, end, mid)
    print(start, end)
    haoi(n-1, mid, start, end)

num = int(input())

print(2**num - 1)

if num <= 20:
    haoi(num, 1, 2, 3)