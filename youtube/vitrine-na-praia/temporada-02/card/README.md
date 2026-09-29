# Card de abertura da T2

- `card-t2-ep01.png`: card 1920×1080 (16:9) do EP01
- `card-t2-ep01.mp4`: o mesmo card animado, **5 s** (zoom suave + fade de entrada e saída, faixa de áudio silenciosa para facilitar a edição)
- `card.html` + `render.js`: modelo para gerar o card dos próximos episódios

## Onde entra no episódio
Gancho (a melhor imagem do imóvel, ~10 s) → **card de 5 s** → apresentação. Substitui a vinheta vertical da T1, que ficava com faixas pretas no YouTube.

## Gerar o card de outro episódio
```bash
# coloque a foto do imóvel (horizontal, de preferência 1920 px ou mais) em assets/
NODE_PATH=$(npm root -g) node render.js 02 "Edifício Milano" "Centro · Capão da Canoa/RS" assets/ep02-milano.jpg
```
Para o MP4 de 5 s, use o mesmo comando `ffmpeg` do commit que criou o card do EP01 (zoompan + fade).

## Identidade
- **Logo:** versão vetorial própria do card (casa + sol + ondas + gaivotas), aprovada pelo Roberto para a T2
- **Foto do Roberto:** a mesma do card da T1, tratada (média de quadros + nitidez) em `assets/roberto.jpg`
- Nunca usar foto com o número do apartamento, placa de andar ou painel do elevador
