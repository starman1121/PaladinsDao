import { useCallback, useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import TabPanel from "../../components/TabPanel";
import { changeApproval, changeClaim } from "../../slices/ClaimThunk";
import { useWeb3Context } from "src/hooks/web3Context";
import { isPendingTxn, txnButtonText } from "src/slices/PendingTxnsSlice";
import {
  Paper,
  Grid,
  Typography,
  Box,
  Zoom,
  Button,
  FormControl,
  InputLabel,
  OutlinedInput,
  InputAdornment,
} from "@material-ui/core";
import { trim } from "../../helpers";
import "./claim.scss";
import { Skeleton } from "@material-ui/lab";
import { error } from "../../slices/MessagesSlice";
import { ethers, BigNumber } from "ethers";

function Claim() {
  const dispatch = useDispatch();
  const { provider, address, connected, connect, chainID } = useWeb3Context();
  const [quantity, setQuantity] = useState("");
  const pendingTransactions = useSelector(state => {
    return state.pendingTransactions;
  });
  const pwandBalance = useSelector(state => {
    return state.account.balances && state.account.balances.pwand;
  });
  console.log("debug --> Claim / pwandBalance : ", pwandBalance);
  const setMax = () => {
    setQuantity(pwandBalance);
  };
  const onSeekApproval = async token => {
    await dispatch(changeApproval({ address, token, provider, networkID: chainID }));
  };
  const claimAllowance = useSelector(state => {
    return state.account.claim && state.account.claim.claimAllowance;
  });
  const onChangeClaim = async action => {
    // eslint-disable-next-line no-restricted-globals
    if (isNaN(quantity) || quantity === 0 || quantity === "") {
      // eslint-disable-next-line no-alert
      return dispatch(error("Please enter a value!"));
    }
    // 1st catch if quantity > balance
    let gweiValue = ethers.utils.parseUnits(quantity, "gwei");
    if (action === "claim" && gweiValue.gt(ethers.utils.parseUnits(pwandBalance, "gwei"))) {
      return dispatch(error("You cannot claim more than your pLDAO balance."));
    }

    await dispatch(changeClaim({ address, action, value: quantity.toString(), provider, networkID: chainID }));
  };
  const hasAllowance = useCallback(
    token => {
      if (token === "pLDAO") return claimAllowance > 0;
      return 0;
    },
    [claimAllowance],
  );
  const isAllowanceDataLoading = claimAllowance == null;
  return (
    <div id="claim-view">
      <Paper className={`ohm-card`}>
        <Grid container direction="column" spacing={2}>
          <Grid item>
            <div className="card-header">
              <Typography variant="h5">Claim</Typography>
            </div>
          </Grid>
        </Grid>
        <Grid item>
          <div className="stake-top-metrics" style={{ whiteSpace: "normal" }}>
            <Grid container spacing={1} alignItems="center" justifyContent="center">
              {address && !isAllowanceDataLoading ? (
                !hasAllowance("pLDAO") ? (
                  <Box className="help-text">
                    <Typography variant="body1" className="stake-note" color="textSecondary">
                      <>
                        First time use <b>pLDAO</b>?
                        <br />
                        Please approve LDAO to use your <b>pLDAO</b> for claim LDAO.
                      </>
                    </Typography>
                  </Box>
                ) : (
                  <Grid item xs={12} sm={7} md={7} lg={7}>
                    <FormControl className="ohm-input" variant="outlined" color="primary">
                      <InputLabel htmlFor="amount-input"></InputLabel>
                      <OutlinedInput
                        id="amount-input"
                        type="number"
                        placeholder="Enter an amount"
                        className="stake-input"
                        value={quantity}
                        onChange={e => setQuantity(e.target.value)}
                        labelWidth={0}
                        endAdornment={
                          <InputAdornment position="end">
                            <Button variant="text" onClick={setMax} color="inherit">
                              Max
                            </Button>
                          </InputAdornment>
                        }
                      />
                    </FormControl>
                  </Grid>
                )
              ) : (
                <Skeleton width="45%" />
              )}

              <Grid item xs={12} sm={1} md={1} lg={1} />

              {isAllowanceDataLoading ? (
                <Skeleton width="45%" />
              ) : address && hasAllowance("pLDAO") ? (
                <Grid item xs={12} sm={4} md={4} lg={4}>
                  <Button
                    className="stake-button"
                    variant="contained"
                    color="primary"
                    disabled={isPendingTxn(pendingTransactions, "claim")}
                    onClick={() => {
                      onChangeClaim("claim");
                    }}
                  >
                    {txnButtonText(pendingTransactions, "claim", "Claim LDAO")}
                  </Button>
                </Grid>
              ) : (
                <Grid item xs={12} sm={6} md={6} lg={6}>
                  <Button
                    className="stake-button"
                    variant="contained"
                    color="primary"
                    disabled={isPendingTxn(pendingTransactions, "approve_claim")}
                    onClick={() => {
                      onSeekApproval("pLDAO");
                    }}
                  >
                    {txnButtonText(pendingTransactions, "approve_claim", "Approve")}
                  </Button>
                </Grid>
              )}
            </Grid>
          </div>
        </Grid>
      </Paper>
    </div>
  );
}

export default Claim;
