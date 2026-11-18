# Trekt de ontwikkelcertificaten in die eerdere TestFlight-builds bij Apple hebben aangemaakt.
# Elke build draait op een verse machine en laat Xcode een nieuw "Apple Development"-certificaat maken; na een aantal builds
# zit het account aan het maximum en faalt het ondertekenen. Distributiecertificaten (App Store) blijven ongemoeid.
# Gebruik: KEY_ID=… ISSUER_ID=… ruby tools/asc-cleanup.rb pad/naar/AuthKey.p8
require "openssl"; require "base64"; require "json"; require "net/http"; require "uri"

def b64(s); Base64.urlsafe_encode64(s, padding: false); end
# JWT voor de App Store Connect API (ES256): de handtekening is r en s achter elkaar, elk 32 bytes
def token(p8, key_id, issuer)
  key = OpenSSL::PKey::EC.new(p8)
  head = b64({alg: "ES256", kid: key_id, typ: "JWT"}.to_json)
  body = b64({iss: issuer, iat: Time.now.to_i, exp: Time.now.to_i + 600, aud: "appstoreconnect-v1"}.to_json)
  der = key.sign(OpenSSL::Digest.new("SHA256"), "#{head}.#{body}")
  r, s = OpenSSL::ASN1.decode(der).value.map { |v| v.value.to_s(2).rjust(32, "\x00".b)[-32, 32] }
  "#{head}.#{body}.#{b64(r + s)}"
end

if __FILE__ == $0
  jwt = token(File.read(ARGV[0]), ENV.fetch("KEY_ID"), ENV.fetch("ISSUER_ID"))
  http = Net::HTTP.new("api.appstoreconnect.apple.com", 443); http.use_ssl = true
  call = ->(req) { req["Authorization"] = "Bearer #{jwt}"; http.request(req) }
  res = call.(Net::HTTP::Get.new("/v1/certificates?filter%5BcertificateType%5D=DEVELOPMENT,IOS_DEVELOPMENT&limit=200&fields%5Bcertificates%5D=name,certificateType,expirationDate"))
  unless res.code == "200"
    warn "Certificaten opvragen lukte niet (#{res.code}); de build gaat gewoon verder."; exit 0
  end
  certs = JSON.parse(res.body)["data"] || []
  puts "#{certs.size} ontwikkelcertificaten gevonden."
  certs.each do |c|
    next unless %w[DEVELOPMENT IOS_DEVELOPMENT].include?(c.dig("attributes", "certificateType"))   # nooit een distributiecertificaat
    d = call.(Net::HTTP::Delete.new("/v1/certificates/#{c["id"]}"))
    puts "#{d.code == "204" ? "ingetrokken" : "niet ingetrokken (#{d.code})"}: #{c.dig("attributes", "name")}"
  end
end
