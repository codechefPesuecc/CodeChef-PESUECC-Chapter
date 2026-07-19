---
title: "Chef's Candy Distribution"
difficulty: "Medium"
points: 100
tags: ["Greedy", "Arrays"]
date: "2026-07-20"
timeLimit: "1s"
memoryLimit: "256 MB"
author: "PESUECC Problem Setters"
---

# Chef's Candy Distribution

Chef is handing out candies to `n` children standing in a line. Each child has a
**rating** based on how well they solved today's warm-up puzzle. Chef must give
out candies under two rules:

1. Every child gets **at least one** candy.
2. Any child with a **strictly higher** rating than an immediate neighbour must
   receive **strictly more** candies than that neighbour.

Chef is generous but not wasteful — help him find the **minimum** total number of
candies he needs to satisfy both rules.

## Input Format

- The first line contains a single integer `n` — the number of children.
- The second line contains `n` space-separated integers `r[1], r[2], …, r[n]` —
  the ratings of the children in line order.

## Output Format

- Print a single integer: the minimum number of candies Chef must distribute.

## Constraints

- `1 ≤ n ≤ 10^5`
- `0 ≤ r[i] ≤ 10^9`

## Sample Input

```text
3
1 0 2
```

## Sample Output

```text
5
```

## Explanation

One optimal distribution is `[2, 1, 2]`:

- The first child (rating `1`) outranks the second (rating `0`), so they need
  more than `1` candy → `2`.
- The third child (rating `2`) outranks the second, so they also need `2`.
- The total is `2 + 1 + 2 = 5`, and no valid distribution uses fewer candies.
