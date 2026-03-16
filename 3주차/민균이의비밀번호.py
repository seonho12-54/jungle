


def find(lst):
    count = 0
    num =0 
    for i in range(len(lst)):
        for k in range(i+1, len(lst)):
            if lst[i][::-1] == lst[k]:
                count +=1
                print(len(lst[i]), lst[i][len(lst[i])//2])
                return
    
    if    count ==0 and k == len(lst)-1:
              print(len(lst[num]), lst[num][len(lst[num])//2])
              return
    
    
    
    
    
    
    
    
    
#여러개 입력하기 문자열

lst =[]
for i in range(int(input())):
    lst.append(input())
    
 
    
find(lst)