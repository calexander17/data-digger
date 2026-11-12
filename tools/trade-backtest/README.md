# Trade grade backtest

How the trade grades' aging curves were fitted and tested, from League of Champions, League of Titans and Flex Luger history.

1. `extract.js` pulls player-season scoring, trades, draft picks and replacement levels from each league's build folder into ds.json.
2. `bio.js` fetches birthdates from MFL into bio.json.
3. `backtest.js` fits the surplus-retention curves (fitted only on seasons before each trade, so the test is honest) and scores past trades: `node backtest.js` compares model variants, `node backtest.js x cal` prints calibration, `node backtest.js x k` writes the final curves.
4. `below.js` fits breakout odds for players below replacement.

Result on 556 trades from 2018 to 2023: the favored side got more points over replacement in the next three seasons about 60% of the time overall and about 65% on the most lopsided deals. Fitted curves beat the original guessed age curves (rank correlation 0.22 vs 0.16); boosting draft pick values made predictions worse.
