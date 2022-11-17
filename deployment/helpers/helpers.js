const hre = require("hardhat");
const {
    deployments: { deploy, get, log },
    getNamedAccounts,
    ethers,
} = hre;

const getStakingModulesNames = () => {
    return {
        StakingAdminModule: "StakingAdminModule",
        StakingGovernanceModule: "StakingGovernanceModule",
        StakingStakeModule: "StakingStakeModule",
        StakingStorageModule: "StakingStorageModule",
        StakingVestingModule: "StakingVestingModule",
        StakingWithdrawModule: "StakingWithdrawModule",
        WeightedStakingModule: "WeightedStakingModule",
    };
};

const stakingRegisterModuleWithMultisig = () => {
    return process.env.STAKING_REG_WITH_MULTISIG == "true";
};

const sendWithMultisig = async (multisigAddress, contractAddress, data, sender, value = 0) => {
    const { ethers } = hre;
    console.log("Multisig tx data:", data);
    const multisig = await ethers.getContractAt("MultiSigWallet", multisigAddress);
    const signer = await ethers.getSigner(sender);
    receipt = await (
        await multisig.connect(signer).submitTransaction(contractAddress, value, data)
    ).wait();

    const abi = ["event Submission(uint256 indexed transactionId)"];
    let iface = new ethers.utils.Interface(abi);
    const parsedEvent = await getParsedEventLogFromReceipt(receipt, iface, "Submission");
    console.log("Multisig tx id:", parsedEvent.transactionId.value.toNumber());
};

const multisigCheckTx = async (txId, multisigAddress = ethers.constants.ADDRESS_ZERO) => {
    const {
        deployments: { get },
        ethers,
    } = hre;
    const multisig = await ethers.getContractAt(
        "MultiSigWallet",
        multisigAddress == ethers.constants.ADDRESS_ZERO
            ? (
                  await get("multisig")
              ).address
            : multisigAddress
    );
    console.log(
        "TX ID: ",
        txId,
        "confirmations: ",
        (await multisig.getConfirmationCount(txId)).toNumber(),
        " Executed:",
        (await multisig.transactions(txId))[3],
        " Confirmed by: ",
        await multisig.getConfirmations(txId)
    );
    console.log("TX Data:", (await multisig.transactions(txId))[2]);
};

const parseEthersLog = (parsed) => {
    let parsedEvent = {};
    for (let i = 0; i < parsed.args.length; i++) {
        const input = parsed.eventFragment.inputs[i];
        const arg = parsed.args[i];
        const newObj = { ...input, ...{ value: arg } };
        parsedEvent[input["name"]] = newObj;
    }
    return parsedEvent;
};

const getEthersLog = async (contract, filter) => {
    if (contract === undefined || filter === undefined) return;
    const events = await contract.queryFilter(filter);
    if (events.length === 0) return;
    let parsedEvents = [];
    for (let event of events) {
        const ethersParsed = contract.interface.parseLog(event);
        const customParsed = parseEthersLog(ethersParsed);
        parsedEvents.push(customParsed);
    }
    return parsedEvents;
};

const getParsedEventLogFromReceipt = async (receipt, iface, eventName) => {
    const topic = iface.getEventTopic(eventName);
    // search for the log by the topic
    const log = receipt.logs.find((x) => x.topics.indexOf(topic) >= 0);
    // finally, you can parse the log with the interface
    // to get a more user-friendly event object
    const parsedLog = iface.parseLog(log);
    return parseEthersLog(parsedLog);
};

const getStakingModuleClashingContracts = async (newModuleAddress) => {
    const clashing = await stakingModulesProxy.checkClashingFuncSelectors(newModuleAddress);
    if (
        clashing.clashingModules.length == 0 &&
        clashing.clashingProxyRegistryFuncSelectors.length == 0
    )
        return [ethers.constants.AddressZero];

    if (clashing.clashingModules.length != 0) {
        const clashingUnique = clashing.clashingModules.filter(arrayToUnique);
        if (clashingUnique.length == 1) {
            const addressModuleBeingReplaced = clashingUnique[0];
            if (addressModuleBeingReplaced != moduleAddressList[i]) {
                log(`Replacing module ${moduleNames[i]}`);
                const receipt = await (
                    await stakingModulesProxy.replaceModule(
                        addressModuleBeingReplaced,
                        moduleAddressList[i]
                    )
                ).wait();

                log(`cumulativeGasUsed: ${receipt.cumulativeGasUsed.toString()}`);
                totalGas = totalGas.add(receipt.cumulativeGasUsed);
            } else log(`Skipping module ${moduleNames[i]} replacement - the module is reused`);
        } else {
            log(`can't replace multiple modules at once:`);
            clashing.clashingModules.forEach((item, index, arr) => {
                log(`${item[index]} - ${arr[1][index]}`);
            });
        }
    }
    if (
        clashing.clashingProxyRegistryFuncSelectors.length !== 0 &&
        clashing.clashingProxyRegistryFuncSelectors[0] != "0x00000000"
    ) {
        log("Clashing functions signatures with ModulesProxy functions:");
        log(clashing.clashingProxyRegistryFuncSelectors);
    }
};

const createProposal = async (
    governorAddress,
    targets,
    values,
    signatures,
    datas,
    description
) => {
    //governorDeployment = (await get("GovernorAlpha")).address;
    console.log(`=============================================================
    Governor Address:    ${governorAddress}
    Target:              ${targets}
    Values:              ${values}
    Signature:           ${signatures}
    Data:                ${datas}
    Description:         ${description}
    =============================================================`);
    const gov = await ethers.getContractAt("GovernorAlpha", governorAddress);
    const tx = await gov.propose(targets, values, signatures, callDatas, description);
    console.log(tx.info());
};

module.exports = {
    getStakingModulesNames,
    stakingRegisterModuleWithMultisig,
    parseEthersLog,
    getEthersLog,
    getParsedEventLogFromReceipt,
    sendWithMultisig,
    multisigCheckTx,
    createProposal,
};
