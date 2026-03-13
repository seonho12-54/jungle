num = int(input())

for i in range(num):
    num1 = list(map(int, input().split()))
    sum1 = 0

    for k in range(num1[0]):
        sum1 += num1[k + 1]

    avg = sum1 / num1[0]

    count = 0
    for k in range(num1[0]):
        if num1[k + 1] > avg:
            count += 1

    rate = (count / num1[0]) * 100
    print(f"{rate:.3f}%")