

a,b =map(int, input().split())

coins = []


for i in range(a):
    coins.append(int(input()))
    #코일들을 리스트에 저장
    
coins.sort(reverse=True)
#b는 change야


count =0
for coin in coins:
    if b ==0:
        break
    count+= b//coin
    b = b%coin
print(count)

