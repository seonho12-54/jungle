def is_palindrome(s):
    
    s = s.lower()
    ns = ""
    for i in s:
        if i.isalnum():
            ns += i
    #ns은 특수기호 없애고 소문자로 바꾼것
    
    #추가로 만들것은 반대로 된것을 확인하고 비교하는것
    rv =""
    rv = rv.join(reversed(ns))
    
    count = 0
    for i in range(len(ns)):
        if ns[i] == rv[i]:
            count += 1
    
    if count == len(ns):
        return True
    else:
        return False
    



    
print(is_palindrome("A man, a plan, a canal: Panama"))
