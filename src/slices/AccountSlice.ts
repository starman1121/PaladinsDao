import { ethers } from "ethers";
import { addresses } from "../constants";
import { abi as ierc20Abi } from "../abi/IERC20.json";
import { abi as sWand } from "../abi/sWand.json";
import { abi as pWand } from "../abi/pWand.json";
import { abi as presaleABI } from "../abi/Presale.json";
import { setAll } from "../helpers";

import { createAsyncThunk, createSelector, createSlice } from "@reduxjs/toolkit";
import { Bond, NetworkID } from "src/lib/Bond"; // TODO: this type definition needs to move out of BOND.
import { RootState } from "src/store";
import { IBaseAddressAsyncThunk, ICalcUserBondDetailsAsyncThunk } from "./interfaces";

export const getBalances = createAsyncThunk(
  "account/getBalances",
  async ({ address, networkID, provider }: IBaseAddressAsyncThunk) => {
    const wandContract = new ethers.Contract(addresses[networkID].LDAO_ADDRESS as string, ierc20Abi, provider);
    const wandBalance = await wandContract.balanceOf(address);
    const swandContract = new ethers.Contract(addresses[networkID].SLDAO_ADDRESS as string, ierc20Abi, provider);
    const swandBalance = await swandContract.balanceOf(address);
    
    let poolBalance = 0;
    // const poolTokenContract = new ethers.Contract(addresses[networkID].PT_TOKEN_ADDRESS as string, ierc20Abi, provider);
    // poolBalance = await poolTokenContract.balanceOf(address);

    return {
      balances: {
        wand: ethers.utils.formatUnits(wandBalance, "gwei"),
        swand: ethers.utils.formatUnits(swandBalance, "gwei"),
        pool: ethers.utils.formatUnits(poolBalance, "gwei"),
      },
    };
  },
);

export const loadAccountDetails = createAsyncThunk(
  "account/loadAccountDetails",
  async ({ networkID, provider, address }: IBaseAddressAsyncThunk) => {
    let wandBalance = 0;
    let swandBalance = 0;
    let pwandBalance = 0;
    let busdBalance = 0;
    let presaleAllowance = 0;
    let claimAllowance = 0;
    let stakeAllowance = 0;
    let unstakeAllowance = 0;
    let busdBondAllowance = 0;
    let poolAllowance = 0;
    
   
    const busdContract = new ethers.Contract(addresses[networkID].BUSD_ADDRESS as string, ierc20Abi, provider);
    busdBalance = await busdContract.balanceOf(address);

    
    const pwandContract = new ethers.Contract(addresses[networkID].PLDAO_ADDRESS as string, pWand, provider);
    pwandBalance = await pwandContract.balanceOf(address);

    const wandContract = new ethers.Contract(addresses[networkID].LDAO_ADDRESS as string, ierc20Abi, provider);
    wandBalance = await wandContract.balanceOf(address);
    stakeAllowance = await wandContract.allowance(address, addresses[networkID].STAKING_HELPER_ADDRESS);

    const swandContract = new ethers.Contract(addresses[networkID].SLDAO_ADDRESS as string, sWand, provider);
    swandBalance = await swandContract.balanceOf(address);
    unstakeAllowance = await swandContract.allowance(address, addresses[networkID].STAKING_ADDRESS);
    poolAllowance = await swandContract.allowance(address, addresses[networkID].PT_PRIZE_POOL_ADDRESS);

    if (addresses[networkID].BUSD_ADDRESS) {
      presaleAllowance = await busdContract.allowance(address, addresses[networkID].PRESALE_ADDRESS);
    }

    if (addresses[networkID].LDAO_ADDRESS) {
      claimAllowance = await pwandContract.allowance(address, addresses[networkID].PRESALE_ADDRESS);
    }

    
    const presaleContract = new ethers.Contract(addresses[networkID].PRESALE_ADDRESS as string, presaleABI, provider);
    const wandPrice = await presaleContract.getPriceForThisAddress(address);
    const remainingAmount = await presaleContract.getUserRemainingAllocation(address);
    const isStarted = await presaleContract.started();
    const isEnded = await presaleContract.ended();
    const minCap = await presaleContract.minCap();
    const cap = await presaleContract.cap();
    let presaleStatus = "Presale has not yet started.";
    if(isStarted){
      presaleStatus = "Presales is Active!";
    } 
    if(isEnded)
      presaleStatus = "Presales was ended";

    return {
      balances: {
        busd: ethers.utils.formatEther(busdBalance),
        wand: ethers.utils.formatUnits(wandBalance, "gwei"),
        swand: ethers.utils.formatUnits(swandBalance, "gwei"),
        pwand: ethers.utils.formatUnits(pwandBalance, "gwei"),
      },
      presale: {
        presaleAllowance: +presaleAllowance,
        tokenPrice: ethers.utils.formatEther(wandPrice),
        remainingAmount: ethers.utils.formatEther(remainingAmount),
        presaleStatus: presaleStatus,
        minCap: ethers.utils.formatEther(minCap),
        cap: ethers.utils.formatEther(cap),
      },
      claim: {
        claimAllowance: +claimAllowance,
      },
      staking: {
        wandStake: +stakeAllowance,
        wandUnstake: +unstakeAllowance,
      },      
      bonding: {
        busdAllowance: busdBondAllowance,
      },
      pooling: {
        swandPool: +poolAllowance,
      },
    };
  },
);

export interface IUserBondDetails {
  allowance: number;
  interestDue: number;
  bondMaturationBlock: number;
  pendingPayout: string; //Payout formatted in gwei.
}
export const calculateUserBondDetails = createAsyncThunk(
  "account/calculateUserBondDetails",
  async ({ address, bond, networkID, provider }: ICalcUserBondDetailsAsyncThunk) => {
    if (!address) {
      return {
        bond: "",
        displayName: "",
        bondIconSvg: "",
        isLP: false,
        allowance: 0,
        balance: "0",
        interestDue: 0,
        bondMaturationBlock: 0,
        pendingPayout: "",
      };
    }
    // dispatch(fetchBondInProgress());

    // Calculate bond details.
    const bondContract = bond.getContractForBond(networkID, provider);
    const reserveContract = bond.getContractForReserve(networkID, provider);

    const busdContract = new ethers.Contract(addresses[networkID].BUSD_ADDRESS as string, ierc20Abi, provider);
    let interestDue, pendingPayout, bondMaturationBlock;

  
    
    const bondDetails = await bondContract.bondInfo(address);
    interestDue = bondDetails.payout / Math.pow(10, 9);
    bondMaturationBlock = +bondDetails.vesting + +bondDetails.lastBlock;
    pendingPayout = await bondContract.pendingPayoutFor(address);

    let allowance,
      balance = 0;
    allowance = await reserveContract.allowance(address, bond.getAddressForBond(networkID));
    balance = await reserveContract.balanceOf(address);
    // formatEthers takes BigNumber => String
    // let balanceVal = ethers.utils.formatEther(balance);
    // balanceVal should NOT be converted to a number. it loses decimal precision
    let deciamls = 18;
    if (bond.name == "usdc") {
      deciamls = 6;
    }
    const balanceVal = balance / Math.pow(10, deciamls);
    return {
      bond: bond.name,
      displayName: bond.displayName,
      bondIconSvg: bond.bondIconSvg,
      isLP: bond.isLP,
      allowance: Number(allowance),
      balance: balanceVal.toString(),
      interestDue,
      bondMaturationBlock,
      pendingPayout: ethers.utils.formatUnits(pendingPayout, "gwei"),
    };
  },
);

interface IAccountSlice {
  bonds: { [key: string]: IUserBondDetails };
  balances: {
    wand: string;
    swand: string;
    pwand: string;
    busd: string;
    dai: string;
  };
  loading: boolean;
}
const initialState: IAccountSlice = {
  loading: false,
  bonds: {},
  balances: { wand: "", swand: "", busd: "", pwand: "", dai: "" },
};

const accountSlice = createSlice({
  name: "account",
  initialState,
  reducers: {
    fetchAccountSuccess(state, action) {
      setAll(state, action.payload);
    },
  },
  extraReducers: builder => {
    builder
      .addCase(loadAccountDetails.pending, state => {
        state.loading = true;
      })
      .addCase(loadAccountDetails.fulfilled, (state, action) => {
        setAll(state, action.payload);
        state.loading = false;
      })
      .addCase(loadAccountDetails.rejected, (state, { error }) => {
        state.loading = false;
        console.log(error);
      })
      .addCase(getBalances.pending, state => {
        state.loading = true;
      })
      .addCase(getBalances.fulfilled, (state, action) => {
        setAll(state, action.payload);
        state.loading = false;
      })
      .addCase(getBalances.rejected, (state, { error }) => {
        state.loading = false;
        console.log(error);
      })
      .addCase(calculateUserBondDetails.pending, state => {
        state.loading = true;
      })
      .addCase(calculateUserBondDetails.fulfilled, (state, action) => {
        if (!action.payload) return;
        const bond = action.payload.bond;
        state.bonds[bond] = action.payload;
        state.loading = false;
      })
      .addCase(calculateUserBondDetails.rejected, (state, { error }) => {
        state.loading = false;
        console.log(error);
      });
  },
});

export default accountSlice.reducer;

export const { fetchAccountSuccess } = accountSlice.actions;

const baseInfo = (state: RootState) => state.account;

export const getAccountState = createSelector(baseInfo, account => account);
