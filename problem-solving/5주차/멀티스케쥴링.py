






def plug(lst, a, b):
    count = 0
    lsta = []
    for i in range(b):
        now = lst[i]
        #지금 기기확인
        if now in lsta:
            continue
        
        if len(lsta) < a:
            lsta.append(now)
            continue
        #기기가 꽉 찼을 때
        
        remove = -1#뺼기기 
        idx = -1#가장 나중에 쓰이는 위치
        
        for k in lsta:
            
            found = False
            
            
            for j in range(i+1,b):
                if lst[j] == k:
                    found = True
                    if j > idx:
                        idx = j
                        remove = k
                    break
                
                
            if found == False:
                remove = k
                break
            
            
        lsta.remove(remove)
        lsta.append(now)
        count += 1
        
        
        
    return count





a,b = map(int, input().split())
lst = list(map(int, input().split()))


print(plug(lst, a, b))