num = int(input())



count = 0
lst =[0]*num
for i in range(num):
    
    n = int(input())
    arr= []
    
    for j in range(n):
        a,b = map(int, input().split())
        arr.append((a, b))
    arr.sort()
    #여기까지 받고`` 정렬을 했습니다.
    count = 1
    min_interview = arr[0][1]

    for k in range(1, n):
        if arr[k][1] < min_interview:
            count += 1
            min_interview = arr[k][1]

    lst[i] = count
    
    
for i in lst:
    print(i)