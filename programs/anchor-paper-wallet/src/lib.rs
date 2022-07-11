use anchor_lang::prelude::*;

declare_id!("8krRoqrVBKMzaYCJNNB9gVPgfT5sp2b7J4jpSiuf9n6U");

pub fn transfer_lamports(from: &AccountInfo, to: &AccountInfo, amount: u64) -> Result<()> {

  require!(
    **from.try_borrow_lamports()? >= amount,
    PaperWalletError::InsufficientLamports
  );

  // Debit from_account
  **from.try_borrow_mut_lamports()? -= amount;

  // Credit to_account
  **to.try_borrow_mut_lamports()? += amount;

  Ok(())
}

#[program]
pub mod anchor_paper_wallet {
    use super::*;

    pub fn store(ctx: Context<Store>, code: String) -> Result<()> {
        let holder = &mut ctx.accounts.holder;
        let signer = &mut ctx.accounts.authority;

        // Only uninitialized can be stored in
        require!(!holder.stored, PaperWalletError::NonEmptyStore);

        // transfer lamports
        let instruction = anchor_lang::solana_program::system_instruction::transfer(
          &signer.key(),
          &holder.key(),
          signer.try_lamports()?
        );

        anchor_lang::solana_program::program::invoke(
          &instruction,
          &[
            signer.to_account_info(),
            holder.to_account_info()
          ]
        )?;

        // store canonical bump
        holder.bump = *ctx.bumps.get("holder").unwrap();
        holder.stored = true;


        Ok(())
    }

    pub fn redeem(ctx: Context<Redeem>, code: String, hash: Pubkey) -> Result<()> {
      let holder = &mut ctx.accounts.holder;
      let signer = &mut ctx.accounts.authority;

      // Only initialized can be redeemed
      require!(holder.stored, PaperWalletError::EmptyRedeem);

      let holder_account_info = holder.to_account_info();

      // returns Ok(()) / Err
      transfer_lamports(&holder_account_info, &signer.to_account_info(), holder_account_info.try_lamports()?)
    }
}

#[derive(Accounts)]
#[instruction(code: String)]
pub struct Store<'info> {
    #[account(
        init,
        payer = authority,
        space = Holder::MAXIMUM_SIZE + 8,
        seeds = [code.as_bytes(), authority.key.as_ref()],
        bump
    )]
    pub holder: Account<'info, Holder>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(code: String, hash: Pubkey)]
pub struct Redeem<'info> {
  #[account(
      mut,
      seeds = [code.as_bytes(), hash.as_ref()],
      bump
  )]
  pub holder: Account<'info, Holder>,
  #[account(mut)]
  pub authority: Signer<'info>,
}

#[account]
pub struct Holder {
    bump: u8,
    stored: bool
}

impl Holder {
    pub const MAXIMUM_SIZE: usize = 1 + 1;
}

#[error_code]
pub enum PaperWalletError {
  // Error Code: 6000
  #[msg("Cannot store to non-empty data")]
  NonEmptyStore,
  #[msg("Insufficient lamports")]
  InsufficientLamports,
  #[msg("Redeeming an account without credit")]
  EmptyRedeem,
}
