







def multi (num, mul , div):
        #원수 곱하려는 횟수 나누는 값의 나머지를 출력
        
    if mul == 1:
        return num % div
        
    temp  = multi(num, mul // 2 ,div)
    
    if mul % 2 == 0:
        return (temp*temp) % div
    
    else: 
        return ( temp*temp*num) % div
        
    
    
    
    
    
    
    
    
    
    
    
    
    
lst = list(map(int,input().split()))
#수를 잘 입력받음

    
print(multi(lst[0] , lst[1], lst[2]))




