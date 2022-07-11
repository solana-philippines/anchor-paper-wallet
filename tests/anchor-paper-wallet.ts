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

    const [holderPDA, _] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from(testCode), signer.publicKey.toBuffer()],
      program.programId
    );

    const user1 = anchor.web3.Keypair.generate();
    const user2 = anchor.web3.Keypair.generate();

    // request for airdrop
    await provider.connection.requestAirdrop(
      user1.publicKey,
      solana * anchor.web3.LAMPORTS_PER_SOL
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
      .redeem(testCode)
      .accounts({
        authority: user1.publicKey,
        holder: holderPDA,
      })
      .signers([user2])
      .rpc();

    const user1AccountInfo = await provider.connection.getAccountInfo(
      user1.publicKey
    );

    const user2AccountInfo = await provider.connection.getAccountInfo(
      user2.publicKey
    );
  });

  it("It does not redeem on uninitialized account", async () => {});
});
