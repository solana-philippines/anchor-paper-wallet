use anchor_lang::prelude::*;

declare_id!("8krRoqrVBKMzaYCJNNB9gVPgfT5sp2b7J4jpSiuf9n6U");

pub fn transfer_lamports(from: AccountInfo, to: AccountInfo, amount: u64) -> Result<()> {

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

        // Only uninitialized can be stored in
        require!(!holder.stored, PaperWalletError::NonEmptyStore);

        msg!("BEFORE bump: {}, stored: {}", holder.bump, holder.stored);

        // store canonical bump
        holder.bump = *ctx.bumps.get("holder").unwrap();
        holder.stored = true;

        msg!("AFTER bump: {}, stored: {}", holder.bump, holder.stored);

        Ok(())
    }

    pub fn redeem(ctx: Context<Redeem>, code: String) -> Result<()> {
      let holder = &mut ctx.accounts.holder;
      let signer = &mut ctx.accounts.authority;

      // Only initialized can be redeemed
      require!(holder.stored, PaperWalletError::NonEmptyStore);

      msg!("hotdog");
      Ok(())
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
#[instruction(code: String)]
pub struct Redeem<'info> {
  #[account(
      mut,
      seeds = [code.as_bytes(), authority.key.as_ref()],
      bump
  )]
  pub holder: Account<'info, Holder>,
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
