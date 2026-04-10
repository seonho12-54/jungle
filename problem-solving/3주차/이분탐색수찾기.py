





lst1 =[]
lst2 =[]

num1 = int(input())

lst1 = list(map(int, input().split()))#비교할수

num2 = int(input())

lst2 = list(map(int, input().split()))#비교대상수

lst1 = set(lst1) #중복 제거




for i in lst2:
    if i in lst1: #비교할 수와 비교 대상수가 같다면
            print(1)

    else:
        print(0)

