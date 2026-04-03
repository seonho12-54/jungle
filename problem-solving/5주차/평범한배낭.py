a,b = map(int, input().split())



#두개씩 받아서 튜플로 만들어서 리스트에 저장

lst = [tuple(map(int, input().split())) for _ in range(a)]

#a 는 물건의 갯수가 들어오고 b는 배낭의 최대 무게가 들어온다.
# 다음은 물건의 가치가 무게가 들어온다 최대가치를 출력하라


num = 0 #무게의 합
dp = [0] * (b + 1) #가치의 합을 저장할 리스트 최대 값을 max로 찾아낼거야


for w,v in lst:
    for k in range(b,w -1, -1):
        dp[k] = max(dp[k], dp[k-w] + v)
print(dp[b])


