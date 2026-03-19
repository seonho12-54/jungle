num = int(input())



lst =[]

lst = list(map(int, input().split()))

#입력이 완료됨
lst.sort()
    
    
best = float('inf')

num1 =0 #start
num2 = num -1 #end

while num1 < num2 :
    s = lst[num1] +lst[num2]
    
    if abs(s) < best:
        best  = abs(s)
        answer1 = num1
        answer2 = num2
    if s < 0 :
        num1 += 1
    else:
        num2 -= 1
print(lst[answer1], lst[answer2])
    
    
    
'''

num1 = 0
num2 = 0# 0에 가까운 수일떄 두 가지를 넣는다 인덱스 값을 넣는다.

total = []
index = []

for i in range(num):
    for k in range(num):
        total.append(lst[i] + lst[k]) #두 수의 합을 리스트에 넣는다
        #예 (7, 0, 2) 합 인덱스 1 2
        index.append((i,k))
        
for i in range(len(total)):
    total[i] = abs(total[i]) #절대값으로 바꿔준다

#최소값의 인덱스 값을 찾는다
idx = total.index(min(total))





#해당 인덱스의 퓨틀 값을 찾는다 그 값의 total 값을 출력한다.
#print(index[idx])  정상작동함

a,b = index[idx]
print(lst[a], lst[b])




'''