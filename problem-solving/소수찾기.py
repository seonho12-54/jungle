num = int(input())

num2 = list(map(int,input().split()))
#1 3 5 7
count =0
same =0
for i in range(num):#4번 실행이됨
    count =0
    for j in range(1, num2[i]+1):
        if num2[i]%j  ==0:
            count+=1
    if count ==2:
        same+=1
    
print(same)