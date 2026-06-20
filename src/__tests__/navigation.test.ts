import { navItems } from '../renderer/utils/navItems'

describe('recurring bookings navigation', () => {
  it('is exposed as a toggleable transaction module', () => {
    expect(navItems).toContainEqual(expect.objectContaining({
      key: 'Wiederkehrend',
      group: 'transactions',
      moduleKey: 'recurring-bookings'
    }))
  })
})
