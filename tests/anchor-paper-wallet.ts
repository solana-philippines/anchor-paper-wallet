import * as anchor from "@project-serum/anchor";
import { Program, ProgramError } from "@project-serum/anchor";
import { AnchorPaperWallet } from "../target/types/anchor_paper_wallet";
import { assert, expect } from "chai";

describe("anchor-paper-wallet", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace
    .AnchorPaperWallet as Program<AnchorPaperWallet>;
  const provider = anchor.getProvider();
  const signer = anchor.web3.Keypair.generate();

  it("It stores", async () => {
    const testCode = "hotdog";

    // request airdrop
    const txAirdrop = await provider.connection.requestAirdrop(
      signer.publicKey,
      10 * anchor.web3.LAMPORTS_PER_SOL
    );

    await provider.connection.confirmTransaction(txAirdrop);

    const [holderPDA, _] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from(testCode), signer.publicKey.toBuffer()],
      program.programId
    );

    const txPromise = await program.methods
      .store(testCode)
      .accounts({
        authority: signer.publicKey,
        holder: holderPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([signer])
      .rpc();

    let holderState = await program.account.holder.fetch(holderPDA);

    expect(await provider.connection.getBalance(signer.publicKey)).to.be.eql(0);
    expect(holderState.stored).to.be.true;
  });

  it("It does not store twice", async () => {
    const testCode = "cheesedog";

    const [holderPDA, _] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from(testCode), signer.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .store(testCode)
        .accounts({
          authority: signer.publicKey,
          holder: holderPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([signer])
        .rpc();

      await program.methods
        .store(testCode)
        .accounts({
          authority: signer.publicKey,
          holder: holderPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([signer])
        .rpc();
    } catch (e) {
      assert.equal(true, true);
      return;
    }

    throw "Transaction did not fail";
  });

  it("It redeems", async () => {
    const testCode = "babaduk";
    const solana = 5;

    const user1 = anchor.web3.Keypair.generate();
    const user2 = anchor.web3.Keypair.generate();

    // request for airdrop for both accounts
    const tx1 = await provider.connection.requestAirdrop(
      user1.publicKey,
      solana * anchor.web3.LAMPORTS_PER_SOL
    );
    const tx2 = await provider.connection.requestAirdrop(
      user2.publicKey,
      solana * anchor.web3.LAMPORTS_PER_SOL
    );

    await provider.connection.confirmTransaction(tx1);
    await provider.connection.confirmTransaction(tx2);

    const user1Balance = await provider.connection.getBalance(user1.publicKey);

    const user2Balance = await provider.connection.getBalance(user2.publicKey);

    // Check that balance was credited from airdrop
    expect(user1Balance).to.be.greaterThan(0);
    expect(user2Balance).to.be.greaterThan(0);

    const [holderPDA, _] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from(testCode), user1.publicKey.toBuffer()],
      program.programId
    );

    // store user1 SOL
    await program.methods
      .store(testCode)
      .accounts({
        authority: user1.publicKey,
        holder: holderPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user1])
      .rpc();

    // redeem stored sol into user2
    await program.methods
      .redeem(testCode, user1.publicKey)
      .accounts({
        authority: user2.publicKey,
        holder: holderPDA,
      })
      .signers([user2])
      .rpc();

    const user1FinalBal = await provider.connection.getBalance(user1.publicKey);

    const user2FinalBal = await provider.connection.getBalance(user2.publicKey);

    expect(user1FinalBal).to.be.eql(0);
    expect(user2FinalBal).to.be.greaterThan(0);
  });

  it("It does not redeem on uninitialized account", async () => {
    const testCode = "babaduk";
    const solana = 5;

    const user1 = anchor.web3.Keypair.generate();

    // request for airdrop for both accounts
    const tx1 = await provider.connection.requestAirdrop(
      user1.publicKey,
      solana * anchor.web3.LAMPORTS_PER_SOL
    );

    await provider.connection.confirmTransaction(tx1);

    const user1Balance = await provider.connection.getBalance(user1.publicKey);

    // Make sure balance was credited from airdrop
    expect(user1Balance).to.be.greaterThan(0);

    const [holderPDA, _] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from(testCode), user1.publicKey.toBuffer()],
      program.programId
    );

    // redeem stored sol into user1
    try {
      await program.methods
        .redeem(testCode, user1.publicKey)
        .accounts({
          authority: user1.publicKey,
          holder: holderPDA,
        })
        .signers([user1])
        .rpc();
    } catch (e) {
      if (e.message.includes("AccountNotInitialized")) {
        assert.isTrue(true);
        return;
      } else {
        throw "Transaction failed, but not for expected error";
      }
    }

    throw "Transaction didn't fail like it's supposed to";
  });
});
