

name = input()
name = name.lower()


strr = [0]*26

num=0
for i in name:
    num = ord(i) - ord('a')
    strr[num] +=1
    
    
    
count = 0

for i in range(len(strr)):
      if strr[i] == max(strr):
            count +=1
            
        
        
        
if count >= 2:
    print("?")
else:    print(chr(strr.index(max(strr))+ord('a')).upper())