
from collections import deque
def qcard(lst):
    
    while len(lst) > 1:
        lst.popleft()
        lst.append(lst.popleft())
    return lst[0]




lst =deque()
num =int(input())
for i in range(1, num+1):
    lst.append(i)



print(qcard(lst))