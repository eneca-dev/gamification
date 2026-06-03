import { ShoppingBag, Ticket, Shield, Heart, Sparkles } from 'lucide-react'

import { CoinStatic } from '@/components/CoinBalance'
import { coinsToByn, formatByn } from '@/modules/shop'
import type { EconomyChannel, EconomyChannels } from '@/modules/admin'

interface SpendingBreakdownProps {
  channels: EconomyChannels
  rate: number
}

interface ChannelCardProps {
  label: string
  channel: EconomyChannel
  unitLabel: string  // «покупатель», «отправитель», «участник»
  icon: React.ComponentType<{ size?: number }>
  rate: number
}

function pluralize(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod100 >= 11 && mod100 <= 14) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

function ChannelCard({ label, channel, unitLabel, icon: Icon, rate }: ChannelCardProps) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-2"
      style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
    >
      <div className="flex items-center gap-2">
        <span
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--apex-bg)', color: 'var(--apex-text-secondary)' }}
        >
          <Icon size={15} />
        </span>
        <span className="text-[12px] font-semibold" style={{ color: 'var(--apex-text)' }}>
          {label}
        </span>
      </div>
      <div
        className="text-[20px] font-bold tabular-nums leading-tight"
        style={{ color: 'var(--apex-text)' }}
      >
        {formatByn(coinsToByn(channel.coins, rate))}
      </div>
      <span style={{ color: 'var(--apex-text-muted)' }}>
        <CoinStatic amount={channel.coins} size="sm" />
      </span>
      <div className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>
        {channel.users} {unitLabel}
      </div>
    </div>
  )
}

export function SpendingBreakdown({ channels, rate }: SpendingBreakdownProps) {
  const userPlural = (n: number) => pluralize(n, 'покупатель', 'покупателя', 'покупателей')
  const senderPlural = (n: number) => pluralize(n, 'отправитель', 'отправителя', 'отправителей')
  const participantPlural = (n: number) => pluralize(n, 'участник', 'участника', 'участников')

  return (
    <section className="space-y-3">
      <h2 className="text-[14px] font-bold" style={{ color: 'var(--apex-text)' }}>
        Куда уходят деньги
      </h2>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <ChannelCard
          label="Магазин"
          channel={channels.shop}
          unitLabel={userPlural(channels.shop.users)}
          icon={ShoppingBag}
          rate={rate}
        />
        <ChannelCard
          label="eneca-game"
          channel={channels.lottery}
          unitLabel={participantPlural(channels.lottery.users)}
          icon={Ticket}
          rate={rate}
        />
        <ChannelCard
          label="Вторая жизнь"
          channel={channels.second_life}
          unitLabel={userPlural(channels.second_life.users)}
          icon={Shield}
          rate={rate}
        />
        <ChannelCard
          label="Платные благодарности"
          channel={channels.paid_gratitudes}
          unitLabel={senderPlural(channels.paid_gratitudes.users)}
          icon={Heart}
          rate={rate}
        />
        <ChannelCard
          label="Квотные благодарности"
          channel={channels.quota_gratitudes}
          unitLabel={senderPlural(channels.quota_gratitudes.users)}
          icon={Sparkles}
          rate={rate}
        />
      </div>
    </section>
  )
}
