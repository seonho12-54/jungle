num = int(input())

lst = list(map(int, input().split()))


lst2 =[]

max_value = 0
#양옆 abs 뺀 값을 lst2에 넣고 max 값을 구한다.
def find_max(lst):
    
    lst2.clear()
    hap =0  
    for i in range(1 ,num):
        lst2.append(abs(lst[i] - lst[i-1]))

    for i in range(len(lst2)):
        hap += lst2[i]
        #여긴 뺀 값을 다 추가 하는 부분.
    return hap



#버블을 한 번 실행할 떄 마다 진행을 해야함

def permute(lst, start):
    global max_value

    if start == num:
        current = find_max(lst)
        if current > max_value:
            max_value = current
        return

    for i in range(start, num):
        lst[start], lst[i] = lst[i], lst[start]
        permute(lst, start+1)
        lst[start], lst[i] = lst[i], lst[start]
   
permute(lst, 0)
print(max_value)