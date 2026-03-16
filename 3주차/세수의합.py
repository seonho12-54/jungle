import sys
input = sys.stdin.readline

'''
num = int(input())


lst = []

for i in range(num):
    lst.append(int(input()))
    
#집합으로 설정함
result = set(lst)



lst = sorted(result)
num1 = lst
#리스트 안에 있는거 정수형으로 변경 정렬된 리스트 만들어짐
# 1,2,3,4,5 입력되는겨


total2 = []

for i in range(len(lst)):
    for j in range(i + 1, len(lst)):
        total2.append((lst[i], lst[j])) #중복안되게 튜플 만들어버림


three = []

for i in total2:
    for k in lst:
        if k not in i:
            three.append((i + (k,)))
            
            
max_num = 0
for i in range(len(three)):
    if (sum(three[i]) == num1) and (max_num < sum(three[i])):
        max_num = sum(three[i])

print(max_num)
'''

num = int(input())
lst = []
for i in range(num):
    lst.append(int(input()))
lst.sort()
two_sum = set()

for i in range(num):
    for k in range(num):
        two_sum.add(lst[i] + lst[k])


for i in range(num -1 , -1, -1):
    for k in range(i+1):
        if lst[i] - lst[k] in two_sum:
            print(lst[i])
            exit()