#탑의 높이와 탑의 갯수를 입력을해
import sys
input = sys.stdin.readline


num = int(input())
lst = list(map(int,input().split()))




stack = [0] * num
result = []
num1 = 0
top = -1 #젤 위 위치

while num1 < num:
    if top>=0 and stack[top][1] <lst[num1]:
        top -= 1
        continue
    if top == -1:
        result.append(0)
    else:
        result.append(stack[top][0]+1)
    
    top +=1
    stack[top] = (num1,lst[num1])
    num1+=1

print(*result)