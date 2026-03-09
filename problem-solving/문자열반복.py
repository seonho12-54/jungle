strr = int(input())



for i in range(strr):
    num, strrr = input().split()
    num = int(num)
    for j in strrr:
        print(j*num, end="")