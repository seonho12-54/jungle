num = []

for _ in range(9):
    num.append(int(input()))
max =0

for i in range(0,9):
        if num[i] > max:
            max = num[i]
            
num2 =0    
for i in range(0,9):
    if num[i] == max:
        num2 = i+1


print(max)

print(num2)