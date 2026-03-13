def is_prime(n):
    if n < 2:
        return False
    for i in range(2, int(n ** 0.5) + 1):
        if n % i == 0:
            return False
    return True


def goldpartition (n): 
    
    if n < 4 or n % 2 != 0:
        return None

    for i in range(n // 2, 1, -1):
        if is_prime(i) and is_prime(n - i):
            return i, n - i

    return None

    
    '''
    
    lst =""
    for i in range(2, n):
        if is_prime(i):
            lst += str(i) + " "
    lst = lst.split()    
    #골드바흐파티션 중 가장 작은 소수합을 가진 것을 찾아야해
#5와5는10이될 수 있다 중복되는 값도 가능하므로 j는 i부터 시작해야한다.
    lst2 = []
    lst3 = []
    for i in range(len(lst)):
        for j in range(i, len(lst)):
            if int(lst[i]) + int(lst[j]) == n:
                lst2.append((lst[i], lst[j]))
    if len(lst2) == 1:
        return lst2[0]
    else:
        for i in range(len(lst2)):
            lst3.append(abs(int(lst2[i][0]) - int(lst2[i][1])))
        return lst2[lst3.index(min(lst3))]
    '''
    






num = int(input())


lst=  []

for i in range(num):
    n = int(input())
    lst = goldpartition(n)
    print(lst[0], lst[1])
    
    '''
    
    lst =""
    for i in range(2, n):
        if is_prime(i):
            lst += str(i) + " "
    lst = lst.split()    
    #골드바흐파티션 중 가장 작은 소수합을 가진 것을 찾아야해
#5와5는10이될 수 있다 중복되는 값도 가능하므로 j는 i부터 시작해야한다.
    lst2 = []
    lst3 = []
    for i in range(len(lst)):
        for j in range(i, len(lst)):
            if int(lst[i]) + int(lst[j]) == n:
                lst2.append((lst[i], lst[j]))
    if len(lst2) == 1:
        return lst2[0]
    else:
        for i in range(len(lst2)):
            lst3.append(abs(int(lst2[i][0]) - int(lst2[i][1])))
        return lst2[lst3.index(min(lst3))]
    '''
    






num = int(input())


lst=  []

for i in range(num):
    n = int(input())
    lst = goldpartition(n)
    print(lst[0], lst[1])