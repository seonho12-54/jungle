def fibonacci_memo(n, memo=None):
    """
    메모이제이션을 사용한 피보나치 (하향식 DP)
    
    Args:
        n: 피보나치 인덱스
        memo: 계산 결과를 저장할 딕셔너리
    
    Returns:
        n번째 피보나치 수
    """
    # TODO: memo가 None이면 빈 딕셔너리로 초기화
    pass
    if memo == None:
        memo = {}
    # TODO: base case 
    pass

    memo[0] = 0
    memo[1] = 1
    # TODO: 이미 계산한 값이 memo에 있으면 반환
    pass
    if n in memo:
        return memo[n]

    # TODO: 재귀 호출하여 계산하고 memo에 저장
    pass
    memo[n] = fibonacci_memo(n - 1, memo) + fibonacci_memo(n - 2, memo)    
    return memo[n]





num= int(input())
print(fibonacci_memo(num))