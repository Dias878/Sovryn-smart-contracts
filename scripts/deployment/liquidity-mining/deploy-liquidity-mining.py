'''
Steps for deploying liquidity mining
 
1. Run this deployment script
2. Deploy the wrapper proxy
3. Set wrapper proxy on LMcontract
4. Set lockedSOV as admin of VestingRegistry3
5. If on mainnet: transfer SOV from adoption pool
'''

from brownie import *

import time
import json
import csv
import math

def main():
    thisNetwork = network.show_active()

    # == Load config =======================================================================================================================
    if thisNetwork == "development":
        acct = accounts[0]
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "testnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "rsk-mainnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/mainnet_contracts.json')
    else:
        raise Exception("network not supported")

    # load deployed contracts addresses
    contracts = json.load(configFile)
    multisig = contracts['multisig']

    balanceBefore = acct.balance()
    
    # == LiquidityMining ===================================================================================================================
    SOVToken = Contract.from_abi("SOV", address = contracts['SOV'], abi=TestToken.abi, owner = acct)

    lockedSOV = acct.deploy(LockedSOV, contracts['SOV'], contracts['VestingRegistry3'], 1, 10, [contracts['multisig']])

    liquidityMiningLogic = acct.deploy(LiquidityMining)
    liquidityMiningProxy = acct.deploy(LiquidityMiningProxy)
    liquidityMiningProxy.setImplementation(liquidityMiningLogic.address)
    liquidityMining = Contract.from_abi("LiquidityMining", address=liquidityMiningProxy.address, abi=LiquidityMining.abi, owner=acct)
    
    # TODO define values
    rewardTokensPerBlock = 1736e14 # 500 SOV per day
    startDelayBlocks = 1 # ~1 day in blocks (assuming 30s blocks)
    numberOfBonusBlocks = 1 # ~1 day in blocks (assuming 30s blocks)
    wrapper = "0x0000000000000000000000000000000000000000" # can be updated later using setWrapper
    liquidityMining.initialize(contracts['SOV'], rewardTokensPerBlock, startDelayBlocks, numberOfBonusBlocks, wrapper, lockedSOV.address)
    
    
    # TODO prepare pool tokens list
    poolTokens = [contracts['iDOC'], contracts['iUSDT'], contracts['iRBTC'], contracts['iBPro'], contracts['ConverterDOC'], contracts['ConverterUSDT'], contracts['ConverterSOV']]
    allocationPoints = [1,1,1,1,2,2,3]
    # token weight = allocationPoint / SUM of allocationPoints for all pool tokens
    withUpdate = False # can be False if we adding pool tokens before mining started
    for i in range(0,len(poolTokens)):
        print('adding pool', i)
        liquidityMining.add(poolTokens[i], allocationPoints[i], withUpdate)

    liquidityMining.transferOwnership(multisig)
    liquidityMiningProxy.setProxyOwner(multisig)

    if thisNetwork == "testnet":
        print('transferring SOV')
        SOVToken.transfer(liquidityMiningProxy.address, 50000e18)

    print("deployment cost:")
    print((balanceBefore - acct.balance()) / 10**18)
