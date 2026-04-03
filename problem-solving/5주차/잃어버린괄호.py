s = input()

plus = 0
minus =0
for i in range(len(s)):
    if s[i] == '-':
        minus += 1
    elif s[i] == '+':
        plus += 1
    else:
        continue
#플러스 기호와 마이너스 기호 갯수파악 후 최소로만드는 값을 도출하려함

num = []
temp =''

for i in s:
    if i == '-' or i == '+':
        num.append(int(temp))
        num.append(i)
        temp = ''
    else:
        temp += i
num.append(int(temp))




result = num[0]
minus = False

for i in range(1, len(num), 2):
    op = num[i]
    number = num[i+1]
    
    if op == '-':
        minus_flag = True
    
    if minus_flag:
        result -= number
    else:
        result += number
        
print(result)